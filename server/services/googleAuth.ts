import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Express } from 'express';
import { storage } from '../storage';
import { generateToken } from '../middleware/auth';

export function setupGoogleAuth(app: Express) {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.warn('[googleAuth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — Google login disabled');
    return;
  }

  app.get('/api/auth/google', (req, res, next) => {
    const callbackURL = `${req.protocol}://${req.hostname}/api/auth/google/callback`;

    const strategy = new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleSub = profile.id;
          const email = profile.emails?.[0]?.value ?? null;
          const displayName = profile.displayName || email || 'Google User';
          const avatarUrl = profile.photos?.[0]?.value ?? null;

          let user = await storage.getUserByProvider('google', googleSub);

          if (!user && email) {
            user = await storage.getUserByEmail(email);
            if (user) {
              await storage.updateUser(user.id, {
                authProvider: 'google',
                authProviderId: googleSub,
                avatarUrl: avatarUrl || user.avatarUrl,
              } as any);
            }
          }

          if (!user) {
            const org = await storage.createOrganization({ name: displayName + '的团队' });
            user = await storage.createUser({
              orgId: org.id,
              email: email || `google_${googleSub}@placeholder.local`,
              displayName,
              avatarUrl,
              role: 'owner',
              isActive: true,
              authProvider: 'google',
              authProviderId: googleSub,
            } as any);
            await storage.createOrgMembership({
              userId: user.id,
              orgId: org.id,
              role: 'owner',
              isActive: true,
            });
          }

          await storage.updateUser(user.id, {
            lastLoginAt: new Date(),
            avatarUrl: avatarUrl || user.avatarUrl,
          } as any);

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    );

    const strategyName = `google:${req.hostname}`;
    passport.use(strategyName, strategy);

    passport.authenticate(strategyName, {
      scope: ['profile', 'email'],
      prompt: 'select_account',
    })(req, res, next);
  });

  app.get('/api/auth/google/callback', (req, res, next) => {
    const strategyName = `google:${req.hostname}`;

    passport.authenticate(strategyName, { session: false }, (err: any, user: any) => {
      if (err || !user) {
        console.error('[googleAuth] callback error:', err);
        return res.redirect('/login?error=auth_failed');
      }

      try {
        const token = generateToken({ userId: user.id, orgId: user.orgId, role: user.role });
        return res.redirect(`/login?token=${encodeURIComponent(token)}`);
      } catch (e) {
        console.error('[googleAuth] token generation error:', e);
        return res.redirect('/login?error=auth_failed');
      }
    })(req, res, next);
  });
}
