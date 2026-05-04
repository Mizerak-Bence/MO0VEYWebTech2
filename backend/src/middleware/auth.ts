import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserModel } from '../models/User';

export type AuthenticatedRequest = Request & {
  userId?: string;
  userRole?: 'user' | 'admin';
  isSystemAdmin?: boolean;
};

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const header = req.header('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ message: 'Missing Authorization header' });
  }

  const token = header.slice('bearer '.length).trim();

  let payload: {
    userId: string;
    role: 'user' | 'admin';
    isSystemAdmin?: boolean;
  };

  try {
    payload = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      role: 'user' | 'admin';
      isSystemAdmin?: boolean;
    };
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    const user = await UserModel.findById(payload.userId).select('role isSystemAdmin isDisabled');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (user.isDisabled) {
      return res.status(403).json({ message: 'Ez a felhasználói fiók le van tiltva.' });
    }

    req.userId = user._id.toString();
    req.userRole = user.role;
    req.isSystemAdmin = !!user.isSystemAdmin;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Ehhez a művelethez admin jogosultság kell.' });
  }

  return next();
};
