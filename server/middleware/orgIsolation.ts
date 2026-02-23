import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      orgId: number;
      currentUserId: number;
    }
  }
}

export function orgIsolation(req: Request, _res: Response, next: NextFunction) {
  const orgHeader = req.headers['x-org-id'];
  const userHeader = req.headers['x-user-id'];

  req.orgId = orgHeader ? parseInt(String(orgHeader), 10) : 1;
  req.currentUserId = userHeader ? parseInt(String(userHeader), 10) : 1;

  if (isNaN(req.orgId) || req.orgId < 1) req.orgId = 1;
  if (isNaN(req.currentUserId) || req.currentUserId < 1) req.currentUserId = 1;

  next();
}
