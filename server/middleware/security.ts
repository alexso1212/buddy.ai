import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Helmet with config suitable for SPA
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://vip.aipro.love", "https://api.anthropic.com", "https://api.openai.com"],
      fontSrc: ["'self'", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow loading external resources (avatars, etc.)
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// CSRF protection for cookie-based session endpoints
export function csrfCheck(req: Request, res: Response, next: NextFunction) {
  // Only protect state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // JWT Bearer token auth is inherently CSRF-safe (not auto-sent by browser)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // For cookie-based sessions, check Origin/Referer header
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return next();
    } catch {}
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost === host) return next();
    } catch {}
  }

  // No valid Origin/Referer matched — block the request
  return res.status(403).json({ error: 'CSRF validation failed' });
}
