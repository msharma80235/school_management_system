import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';
import prisma from '../prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & { isModerator?: boolean };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyToken(token);

    // Deactivation, locks, and org disabling all take effect immediately,
    // cutting off existing sessions — not just future logins.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { is_active: true, is_locked: true, is_moderator: true, org_id: true, org: { select: { is_active: true } } },
    });
    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Account is deactivated. Contact your administrator.' });
      return;
    }
    if (user.is_locked) {
      res.status(401).json({ error: 'Account is locked. Contact your administrator.' });
      return;
    }
    if (user.org_id && (!user.org || !user.org.is_active)) {
      res.status(401).json({ error: 'Organization is disabled. Contact the platform administrator.' });
      return;
    }

    req.user = { ...payload, isModerator: user.is_moderator };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Admins always moderate; other users only when the admin has assigned them as moderators
export function requireModerator(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'admin' && !req.user.isModerator) {
    res.status(403).json({ error: 'Moderator access required' });
    return;
  }
  next();
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
