import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      orgId: number;
      currentUserId: number;
    }
  }
}

if (!process.env.JWT_SECRET) {
  throw new Error('[orgIsolation] JWT_SECRET environment variable is required.');
}
const JWT_SECRET = process.env.JWT_SECRET;

export function orgIsolation(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; orgId: number; role: string };
      req.currentUserId = decoded.userId;
      req.orgId = decoded.orgId;
      return next();
    } catch {
    }
  }

  req.orgId = 0;
  req.currentUserId = 0;

  next();
}
