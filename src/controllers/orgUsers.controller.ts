import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';

const userSelect = {
  id: true, name: true, email: true, role: true, subject: true,
  is_active: true, is_locked: true, is_moderator: true, created_at: true,
};

// All users of the admin's organization, every role in one list
export async function listOrgUsers(req: Request, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { org_id: req.user!.orgId },
      select: userSelect,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    // Flag parents who have no active enrolled student so the UI can grey them out
    const activeLinks = await prisma.parentStudent.findMany({
      where: { student: { org_id: req.user!.orgId, is_active: true } },
      select: { parent_id: true },
    });
    const parentsWithActive = new Set(activeLinks.map((l) => l.parent_id));
    const formatted = users.map((u) =>
      u.role === 'parent' ? { ...u, has_active_students: parentsWithActive.has(u.id) } : u
    );

    res.json({ users: formatted, me: req.user!.userId });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Shared guards for acting on a user
async function findTarget(req: Request, res: Response) {
  const id = req.params.id as string;
  if (id === req.user!.userId) {
    res.status(400).json({ error: 'You cannot perform this action on your own account' });
    return null;
  }
  const target = await prisma.user.findFirst({ where: { id, org_id: req.user!.orgId } });
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }
  return target;
}

// An org must always keep at least one usable (active + unlocked) admin
async function wouldRemoveLastUsableAdmin(orgId: string, targetId: string): Promise<boolean> {
  const otherUsable = await prisma.user.count({
    where: { org_id: orgId, role: 'admin', is_active: true, is_locked: false, id: { not: targetId } },
  });
  return otherUsable === 0;
}

export async function toggleUserActive(req: Request, res: Response): Promise<void> {
  try {
    const target = await findTarget(req, res);
    if (!target) return;

    if (target.is_active && target.role === 'admin' && await wouldRemoveLastUsableAdmin(req.user!.orgId!, target.id)) {
      res.status(400).json({ error: 'Cannot deactivate the only usable admin account' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: { is_active: !target.is_active },
      select: userSelect,
    });
    res.json({ message: `${user.name} ${user.is_active ? 'activated' : 'deactivated'}`, user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function toggleUserLock(req: Request, res: Response): Promise<void> {
  try {
    const target = await findTarget(req, res);
    if (!target) return;

    if (!target.is_locked && target.role === 'admin' && await wouldRemoveLastUsableAdmin(req.user!.orgId!, target.id)) {
      res.status(400).json({ error: 'Cannot lock the only usable admin account' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: { is_locked: !target.is_locked },
      select: userSelect,
    });
    res.json({ message: `${user.name} ${user.is_locked ? 'locked' : 'unlocked'}`, user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Grant or revoke the moderator flag — any number of users can hold it
export async function toggleUserModerator(req: Request, res: Response): Promise<void> {
  try {
    const target = await findTarget(req, res);
    if (!target) return;

    const user = await prisma.user.update({
      where: { id: target.id },
      data: { is_moderator: !target.is_moderator },
      select: userSelect,
    });
    res.json({ message: `${user.name} is ${user.is_moderator ? 'now a moderator' : 'no longer a moderator'}`, user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resetUserPassword(req: Request, res: Response): Promise<void> {
  try {
    const target = await findTarget(req, res);
    if (!target) return;

    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const hashed = await hashPassword(new_password);
    await prisma.user.update({ where: { id: target.id }, data: { password: hashed } });
    res.json({ message: `Password reset for ${target.name}` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
