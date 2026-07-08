import prisma from '../prisma/client';
import { sendEmail } from './email';
import { sendSms } from './smsAdapter';

// The categories a user can opt out of, per channel. Keep in sync with the
// client preferences page.
export const NOTIFICATION_CATEGORIES = ['marks', 'moderation', 'attendance', 'invitation', 'general'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotifyInput {
  userId: string;
  orgId?: string | null;
  category: NotificationCategory;
  title: string;
  body?: string;
  link?: string;
}

interface Channels { in_app: boolean; email: boolean; sms: boolean; }

// Missing preference row => defaults (in-app + email on, SMS off).
async function channelsFor(userId: string, category: string): Promise<Channels> {
  const p = await prisma.notificationPreference.findUnique({
    where: { user_id_category: { user_id: userId, category } },
  });
  return { in_app: p?.in_app ?? true, email: p?.email ?? true, sms: p?.sms ?? false };
}

// Deliver one notification across the channels the user hasn't opted out of.
// Best-effort: the in-app row is awaited (fast local write); email/SMS are
// fired without blocking the request. Never throws.
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const ch = await channelsFor(input.userId, input.category);

    if (ch.in_app) {
      await prisma.notification.create({
        data: {
          user_id: input.userId,
          org_id: input.orgId ?? null,
          category: input.category,
          title: input.title,
          body: input.body || null,
          link: input.link || null,
        },
      });
    }

    if (ch.email || ch.sms) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, phone: true },
      });
      const text = input.body ? `${input.title}\n\n${input.body}` : input.title;
      if (ch.email && user?.email) void sendEmail({ to: user.email, subject: input.title, text });
      if (ch.sms && user?.phone) void sendSms(user.phone, text);
    }
  } catch (err) {
    console.error('notify failed:', err);
  }
}

// Fan out the same notification to several users (deduplicated).
export async function notifyMany(userIds: (string | null | undefined)[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
  const unique = [...new Set(userIds.filter((id): id is string => !!id))];
  await Promise.all(unique.map((userId) => notify({ ...input, userId })));
}
