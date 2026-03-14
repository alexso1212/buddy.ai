import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('[auth] JWT_SECRET environment variable is required. Set it in Secrets to ensure stable sessions.');
}
const JWT_SECRET = process.env.JWT_SECRET;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; orgId: number; role: string; exp?: number; iat?: number };
    req.currentUserId = decoded.userId;
    req.orgId = decoded.orgId;
    (req as any).userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; orgId: number; role: string };
    req.currentUserId = decoded.userId;
    req.orgId = decoded.orgId;
    (req as any).userRole = decoded.role;
  } catch {
  }
  next();
}

export function generateToken(payload: { userId: number; orgId: number; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function getTokenExpiry(token: string): number | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { exp?: number };
    return decoded.exp || null;
  } catch {
    return null;
  }
}
