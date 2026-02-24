import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; orgId: number; role: string };
    req.currentUserId = decoded.userId;
    req.orgId = decoded.orgId;
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
  } catch {
  }
  next();
}

export function generateToken(payload: { userId: number; orgId: number; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
