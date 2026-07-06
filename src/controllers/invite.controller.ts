import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

const INVITABLE_ROLES = ['teacher', 'student', 'parent', 'volunteer', 'staff'];
const INVITE_VALID_DAYS = 7;

function makeCode(): string {
  // 8 chars, unambiguous alphabet
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join('');
}

const inviteInclude = {
  student: { select: { id: true, first_name: true, last_name: true, roll_number: true } },
  creator: { select: { id: true, name: true } },
};

function inviteState(inv: { status: string; expires_at: Date }): string {
  if (inv.status !== 'pending') return inv.status;
  return inv.expires_at < new Date() ? 'expired' : 'pending';
}

// Admin: create an invitation
export async function createInvite(req: Request, res: Response): Promise<void> {
  try {
    const { role, email, name, subject, student_id } = req.body;
    const orgId = req.user!.orgId;

    if (!role || !INVITABLE_ROLES.includes(role)) {
      res.status(400).json({ error: `Role must be one of: ${INVITABLE_ROLES.join(', ')}` });
      return;
    }

    if (role === 'student') {
      if (!student_id) { res.status(400).json({ error: 'Select the student this login invite is for' }); return; }
      const student = await prisma.student.findFirst({ where: { id: student_id, org_id: orgId } });
      if (!student) { res.status(404).json({ error: 'Student not found' }); return; }
      if (student.user_id) { res.status(409).json({ error: 'This student already has a login account' }); return; }
    }
    if (role === 'parent' && student_id) {
      const student = await prisma.student.findFirst({ where: { id: student_id, org_id: orgId } });
      if (!student) { res.status(404).json({ error: 'Student not found' }); return; }
    }

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email_org_id: { email, org_id: orgId! } } });
      if (existing) { res.status(409).json({ error: 'A user with this email already exists in your organization' }); return; }
    }

    const invite = await prisma.invitation.create({
      data: {
        code: makeCode(),
        role,
        email: email || null,
        name: name || null,
        subject: role === 'teacher' ? subject || null : null,
        student_id: role === 'student' || role === 'parent' ? student_id || null : null,
        expires_at: new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000),
        created_by: req.user!.userId,
        org_id: orgId!,
      },
      include: inviteInclude,
    });

    res.status(201).json({ message: 'Invitation created', invite: { ...invite, state: 'pending' } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: list invitations
export async function listInvites(req: Request, res: Response): Promise<void> {
  try {
    const invites = await prisma.invitation.findMany({
      where: { org_id: req.user!.orgId },
      include: inviteInclude,
      orderBy: { created_at: 'desc' },
    });
    res.json({ invites: invites.map((i) => ({ ...i, state: inviteState(i) })) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: revoke a pending invitation
export async function revokeInvite(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const invite = await prisma.invitation.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!invite) { res.status(404).json({ error: 'Invitation not found' }); return; }
    if (invite.status === 'accepted') { res.status(400).json({ error: 'Cannot revoke an accepted invitation' }); return; }

    await prisma.invitation.update({ where: { id }, data: { status: 'revoked' } });
    res.json({ message: 'Invitation revoked' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Public: look up an invite code (shows what the invite is for)
export async function lookupInvite(req: Request, res: Response): Promise<void> {
  try {
    const code = (req.params.code as string).toUpperCase().trim();
    const invite = await prisma.invitation.findUnique({
      where: { code },
      include: { ...inviteInclude, org: { select: { name: true, slug: true, is_active: true } } },
    });

    if (!invite || !invite.org.is_active) { res.status(404).json({ error: 'Invitation not found' }); return; }
    const state = inviteState(invite);
    if (state !== 'pending') {
      res.status(410).json({ error: state === 'expired' ? 'This invitation has expired — ask your school for a new one' : `This invitation has been ${state}` });
      return;
    }

    res.json({
      invite: {
        code: invite.code,
        role: invite.role,
        name: invite.name,
        email: invite.email,
        subject: invite.subject,
        student: invite.student,
        org: { name: invite.org.name, slug: invite.org.slug },
        expires_at: invite.expires_at,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Public: accept an invite → create the account and log in
export async function acceptInvite(req: Request, res: Response): Promise<void> {
  try {
    const code = (req.params.code as string).toUpperCase().trim();
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const invite = await prisma.invitation.findUnique({
      where: { code },
      include: { org: { select: { id: true, name: true, slug: true, is_active: true } } },
    });
    if (!invite || !invite.org.is_active) { res.status(404).json({ error: 'Invitation not found' }); return; }
    if (inviteState(invite) !== 'pending') {
      res.status(410).json({ error: 'This invitation is no longer valid' });
      return;
    }
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      res.status(400).json({ error: `This invitation was issued for ${invite.email}` });
      return;
    }

    const dup = await prisma.user.findUnique({ where: { email_org_id: { email, org_id: invite.org_id } } });
    if (dup) { res.status(409).json({ error: 'A user with this email already exists in this organization' }); return; }

    // Student invites: the linked student must still be login-less
    if (invite.role === 'student' && invite.student_id) {
      const student = await prisma.student.findUnique({ where: { id: invite.student_id } });
      if (!student || student.user_id) {
        res.status(409).json({ error: 'This student already has a login account' });
        return;
      }
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name, email, password: hashed,
        role: invite.role,
        subject: invite.role === 'teacher' ? invite.subject : null,
        org_id: invite.org_id,
      },
    });

    if (invite.role === 'student' && invite.student_id) {
      await prisma.student.update({ where: { id: invite.student_id }, data: { user_id: user.id } });
    }
    if (invite.role === 'parent' && invite.student_id) {
      await prisma.parentStudent.create({ data: { parent_id: user.id, student_id: invite.student_id } }).catch(() => {});
    }

    await prisma.invitation.update({
      where: { id: invite.id },
      data: { status: 'accepted', accepted_at: new Date() },
    });

    const token = generateToken({ userId: user.id, email: user.email, role: user.role, orgId: invite.org_id });

    res.status(201).json({
      message: 'Welcome aboard!',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      org: { id: invite.org.id, name: invite.org.name, slug: invite.org.slug },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
