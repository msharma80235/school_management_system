import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { notify } from '../utils/notify';
import { sendEmail } from '../utils/email';
import { scanText } from '../utils/contentSafety';

// Any signed-in user can send a support/contact message to their school's
// admins. Delivered two ways: an in-app notification to every admin (always
// works) and an email to the admins/org (best-effort, when SMTP is configured)
// with reply-to set to the sender so an admin can respond directly.
export async function sendSupportRequest(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const subject = String(req.body.subject || '').trim().slice(0, 150);
    const message = String(req.body.message || '').trim();
    const page = String(req.body.page || '').trim().slice(0, 200);

    if (message.length < 5) { res.status(400).json({ error: 'Please describe your issue in a little more detail.' }); return; }
    if (message.length > 4000) { res.status(400).json({ error: 'Message is too long (max 4000 characters).' }); return; }

    // Same kid-safety gate used across the app.
    if (scanText(`${subject}\n${message}`).status === 'flagged') {
      res.status(400).json({ error: 'Your message contains words that are not allowed here. Please rephrase it.' });
      return;
    }

    const sender = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true, email: true, role: true } });
    const senderName = sender?.name || sender?.email || 'A user';
    const senderRole = sender?.role || req.user!.role;

    const org = orgId ? await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, email: true } }) : null;
    const admins = orgId
      ? await prisma.user.findMany({ where: { org_id: orgId, role: 'admin', is_active: true }, select: { id: true, email: true } })
      : [];

    const title = `Support request from ${senderName}`;
    const emailBody = [
      `From: ${senderName} (${senderRole})${sender?.email ? ` <${sender.email}>` : ''}`,
      page ? `Page: ${page}` : '',
      subject ? `Subject: ${subject}` : '',
      '',
      message,
    ].filter(Boolean).join('\n');

    // In-app: notify every admin except the sender (an admin can contact support too).
    const inAppBody = subject ? `${subject} — ${message.slice(0, 160)}` : message.slice(0, 180);
    await Promise.all(
      admins
        .filter((a) => a.id !== req.user!.userId)
        .map((a) => notify({ userId: a.id, orgId, category: 'general', title, body: inAppBody }))
    );

    // Email: to the org address + every admin, reply-to the sender. Best-effort.
    const to = [...new Set([org?.email, ...admins.map((a) => a.email)].filter(Boolean))].join(', ');
    if (to) {
      sendEmail({
        to,
        subject: `[Support] ${subject || 'Request'} — ${org?.name || 'Education Hub'}`,
        text: emailBody,
        replyTo: sender?.email || undefined,
      }).catch((e) => console.error('support email failed:', e));
    }

    res.json({ message: 'Your message was sent to your school administrator. They will get back to you.' });
  } catch (error) {
    console.error('support request error:', error);
    res.status(500).json({ error: 'Could not send your message. Please try again.' });
  }
}
