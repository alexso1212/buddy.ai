import { Router } from 'express';
import crypto from 'crypto';
import { storage } from '../storage';
import { generateToken } from '../middleware/auth';

const googleRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function getRedirectUri(req: any): string {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/api/auth/google/callback`;
}

googleRouter.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google OAuth 未配置' });
  }

  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

googleRouter.get('/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      console.error('[Google OAuth] Error:', error);
      return sendAuthResult(res, null, 'auth_failed');
    }

    if (!code || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return sendAuthResult(res, null, 'auth_failed');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: getRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.text();
      console.error('[Google OAuth] Token exchange failed:', errData);
      return sendAuthResult(res, null, 'auth_failed');
    }

    const tokens = await tokenRes.json();

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      console.error('[Google OAuth] User info fetch failed');
      return sendAuthResult(res, null, 'auth_failed');
    }

    const googleUser = await userInfoRes.json();
    const { id: googleId, email, name, picture } = googleUser;

    let user = await storage.getUserByProvider('google', googleId);

    if (!user && email) {
      user = await storage.getUserByEmail(email);
      if (user) {
        await storage.updateUser(user.id, {
          authProvider: 'google',
          authProviderId: googleId,
          avatarUrl: picture || user.avatarUrl,
          emailVerified: true,
        } as any);
      }
    }

    if (!user) {
      const displayName = name || email?.split('@')[0] || 'User';
      const org = await storage.createOrganization({ name: displayName + '的团队' });
      user = await storage.createUser({
        orgId: org.id,
        email: email || `google_${googleId}@placeholder.local`,
        displayName,
        avatarUrl: picture || null,
        role: 'owner',
        isActive: true,
        authProvider: 'google',
        authProviderId: googleId,
        emailVerified: true,
        onboardingCompleted: false,
      } as any);
      await storage.createOrgMembership({ userId: user.id, orgId: org.id, role: 'owner', isActive: true });
    }

    await storage.updateUser(user.id, {
      lastLoginAt: new Date(),
      avatarUrl: picture || user.avatarUrl,
    } as any);

    try {
      await storage.createActivityLog({
        orgId: user.orgId,
        userId: user.id,
        entityType: 'auth',
        entityId: user.id,
        action: 'login_google',
        changes: JSON.stringify({ ip: req.ip }),
        source: 'system',
      });
    } catch {}

    const jwtToken = generateToken({ userId: user.id, orgId: user.orgId, role: user.role });
    return sendAuthResult(res, jwtToken, null);
  } catch (e: any) {
    console.error('[Google OAuth] Callback error:', e);
    return sendAuthResult(res, null, 'auth_failed');
  }
});

function sendAuthResult(res: any, token: string | null, error: string | null) {
  const html = `<!DOCTYPE html>
<html><head><title>登录中...</title></head>
<body>
<p id="msg" style="text-align:center;margin-top:40vh;font-family:sans-serif;color:#666;">正在完成登录...</p>
<script>
(function() {
  var token = ${token ? JSON.stringify(token) : 'null'};
  var error = ${error ? JSON.stringify(error) : 'null'};
  var target = token ? '/login?token=' + encodeURIComponent(token) : '/login?error=' + (error || 'auth_failed');

  try {
    localStorage.setItem('google_auth_result', JSON.stringify({ token: token, error: error, ts: Date.now() }));
  } catch(e) {}

  try {
    if (window.opener && !window.opener.closed) {
      window.opener.location.href = target;
      setTimeout(function() { window.close(); }, 300);
      return;
    }
  } catch(e) {}

  window.location.href = target;
})();
</script>
</body></html>`;
  res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
}

export default googleRouter;
