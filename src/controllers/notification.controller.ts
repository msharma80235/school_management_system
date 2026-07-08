import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { NOTIFICATION_CATEGORIES } from '../utils/notify';

// The current user's notifications, newest first, plus an unread count.
export async function listMyNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const take = Math.min(Number(req.query.limit) || 50, 200);

    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, take }),
      prisma.notification.count({ where: { user_id: userId, read_at: null } }),
    ]);

    res.json({ notifications, unread });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Lightweight endpoint for the bell to poll.
export async function unreadCount(req: Request, res: Response): Promise<void> {
  try {
    const unread = await prisma.notification.count({ where: { user_id: req.user!.userId, read_at: null } });
    res.json({ unread });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markRead(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    // Scope by user so no one can mark another person's notification read.
    const result = await prisma.notification.updateMany({
      where: { id, user_id: req.user!.userId, read_at: null },
      data: { read_at: new Date() },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Notification not found' }); return; }
    res.json({ message: 'Marked read' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  try {
    const result = await prisma.notification.updateMany({
      where: { user_id: req.user!.userId, read_at: null },
      data: { read_at: new Date() },
    });
    res.json({ message: `Marked ${result.count} read`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Preferences for every category, defaults filled in for categories the user
// has never customized.
export async function getPreferences(req: Request, res: Response): Promise<void> {
  try {
    const rows = await prisma.notificationPreference.findMany({ where: { user_id: req.user!.userId } });
    const byCategory = new Map(rows.map((r) => [r.category, r]));

    const preferences = NOTIFICATION_CATEGORIES.map((category) => {
      const r = byCategory.get(category);
      return {
        category,
        in_app: r?.in_app ?? true,
        email: r?.email ?? true,
        sms: r?.sms ?? false,
      };
    });

    res.json({ preferences });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updatePreference(req: Request, res: Response): Promise<void> {
  try {
    const { category, in_app, email, sms } = req.body;
    if (!NOTIFICATION_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Unknown notification category' }); return;
    }

    const data = {
      in_app: in_app !== undefined ? !!in_app : true,
      email: email !== undefined ? !!email : true,
      sms: sms !== undefined ? !!sms : false,
    };

    const preference = await prisma.notificationPreference.upsert({
      where: { user_id_category: { user_id: req.user!.userId, category } },
      create: { user_id: req.user!.userId, category, ...data },
      update: data,
    });

    res.json({ message: 'Preference updated', preference });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
