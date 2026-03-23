import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export type AuthenticatedRequest = Request & {
  userId?: string;
  userRole?: 'user' | 'admin';
  isSystemAdmin?: boolean;
};

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const header = req.header('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ message: 'Missing Authorization header' });
  }

  const token = header.slice('bearer '.length).trim();
  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      role: 'user' | 'admin';
      isSystemAdmin?: boolean;
    };
    req.userId = payload.userId;
    req.userRole = payload.role;
    req.isSystemAdmin = !!payload.isSystemAdmin;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
