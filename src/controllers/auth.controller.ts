import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { generateToken } from '../utils/jwt';
import { comparePassword, hashPassword } from '../utils/password';
import { audit } from '../utils/audit';

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, org_slug } = req.body;

    if (!email || !password || !org_slug) {
      res.status(400).json({ error: 'Email, password, and organization are required' });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { slug: org_slug } });
    if (!org) {
      res.status(401).json({ error: 'Organization not found' });
      return;
    }

    if (!org.is_active) {
      res.status(401).json({ error: 'Organization is deactivated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email_org_id: { email, org_id: org.id } },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!user.is_active) {
      res.status(401).json({ error: 'Account is deactivated' });
      return;
    }

    if (user.is_locked) {
      res.status(401).json({ error: 'Account is locked. Contact your administrator.' });
      return;
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      orgId: org.id,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        subject: user.subject,
        is_moderator: user.is_moderator,
        org_id: org.id,
      },
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subject: true,
        is_active: true,
        is_moderator: true,
        org_id: true,
        created_at: true,
        org: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user, org: user.org });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    await audit(req, 'account.password_change', {
      orgId: user.org_id,
      targetType: 'user', targetId: user.id,
      summary: `${user.name} changed their own password`,
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Platform super admin login (no organization)
export async function superLogin(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { email, role: 'superadmin', org_id: null },
    });

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role, orgId: '' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function lookupOrg(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const org = await prisma.organization.findUnique({
      where: { slug: slug as string },
      select: { id: true, name: true, slug: true, is_active: true },
    });

    if (!org || !org.is_active) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({ org });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
