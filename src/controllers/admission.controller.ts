import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../prisma/client';
import { scanText } from '../utils/contentSafety';
import { sendEmail } from '../utils/email';
import { audit } from '../utils/audit';

const STAGES = ['enquiry', 'reviewing', 'accepted', 'rejected', 'enrolled'];
const INVITE_VALID_DAYS = 7;

function makeCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join('');
}

function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
}

// ── Public: submit an enquiry for a given organization (by slug) ─────────────
export async function submitEnquiry(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const { student_name, guardian_name, email, phone, date_of_birth, gender, grade_applying, message } = req.body;

    if (!student_name?.trim() || !guardian_name?.trim()) {
      res.status(400).json({ error: 'Student name and guardian name are required' }); return;
    }
    if (!email?.trim() && !phone?.trim()) {
      res.status(400).json({ error: 'Provide an email or phone so the school can reach you' }); return;
    }

    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org || !org.is_active) { res.status(404).json({ error: 'School not found' }); return; }

    // Keep inappropriate free-text out of the system.
    const scan = scanText([student_name, guardian_name, grade_applying, message].filter(Boolean).join(' '));
    if (scan.status === 'flagged') {
      res.status(400).json({ error: 'Your enquiry contains content that is not appropriate. Please revise and try again.' }); return;
    }

    await prisma.admission.create({
      data: {
        org_id: org.id,
        student_name: student_name.trim(),
        guardian_name: guardian_name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        date_of_birth: date_of_birth || null,
        gender: gender || null,
        grade_applying: grade_applying?.trim() || null,
        message: message?.trim() || null,
      },
    });

    // Acknowledge to the applicant (best-effort, email-only — they have no account).
    if (email?.trim()) {
      sendEmail({
        to: email.trim(),
        subject: `We received your enquiry — ${org.name}`,
        text: `Hello ${guardian_name},\n\nThank you for your admission enquiry for ${student_name} at ${org.name}. `
          + `Our admissions team will review it and get back to you.\n\n— ${org.name}`,
      }).catch((e) => console.error('enquiry ack email:', e));
    }

    res.status(201).json({ message: 'Enquiry submitted. The school will get back to you.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Admin: list admissions (optionally by stage) ─────────────────────────────
export async function listAdmissions(req: Request, res: Response): Promise<void> {
  try {
    const { stage } = req.query as { stage?: string };
    const where: any = { org_id: req.user!.orgId };
    if (stage && STAGES.includes(stage)) where.stage = stage;

    const admissions = await prisma.admission.findMany({
      where,
      include: { student: { select: { id: true, first_name: true, last_name: true, roll_number: true } } },
      orderBy: { created_at: 'desc' },
    });

    // Funnel counts for the board headers.
    const grouped = await prisma.admission.groupBy({
      by: ['stage'], where: { org_id: req.user!.orgId }, _count: true,
    });
    const counts: Record<string, number> = {};
    STAGES.forEach((s) => { counts[s] = 0; });
    grouped.forEach((g) => { counts[g.stage] = g._count; });

    res.json({ admissions, counts });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Admin: move an admission through the funnel ──────────────────────────────
export async function updateStage(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { stage, decision_note } = req.body;
    if (!['reviewing', 'accepted', 'rejected'].includes(stage)) {
      res.status(400).json({ error: 'Stage must be reviewing, accepted, or rejected' }); return;
    }

    const existing = await prisma.admission.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Admission not found' }); return; }
    if (existing.stage === 'enrolled') { res.status(400).json({ error: 'This applicant is already enrolled' }); return; }

    const admission = await prisma.admission.update({
      where: { id },
      data: { stage, decision_note: decision_note?.trim() || null, reviewed_by: req.user!.userId, reviewed_at: new Date() },
    });

    await audit(req, `admission.${stage}`, {
      targetType: 'admission', targetId: id,
      summary: `Marked admission for ${existing.student_name} as ${stage}`,
      metadata: decision_note ? { note: decision_note } : undefined,
    });

    // Tell the applicant about a decision (email-only).
    if ((stage === 'accepted' || stage === 'rejected') && existing.email) {
      const org = await prisma.organization.findUnique({ where: { id: existing.org_id }, select: { name: true } });
      sendEmail({
        to: existing.email,
        subject: `Admission update — ${org?.name || 'School'}`,
        text: stage === 'accepted'
          ? `Good news! The application for ${existing.student_name} has been accepted.${decision_note ? `\n\n${decision_note}` : ''}\n\nThe school will be in touch with next steps.`
          : `Thank you for your interest. After review, we're unable to offer a place for ${existing.student_name} at this time.${decision_note ? `\n\n${decision_note}` : ''}`,
      }).catch((e) => console.error('admission decision email:', e));
    }

    res.json({ message: `Marked ${stage}`, admission });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Admin: convert an accepted admission into an enrolled Student ─────────────
export async function convertAdmission(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { class_id, roll_number, parent_phone, create_parent_invite } = req.body;
    const orgId = req.user!.orgId!;

    const admission = await prisma.admission.findFirst({ where: { id, org_id: orgId } });
    if (!admission) { res.status(404).json({ error: 'Admission not found' }); return; }
    if (admission.stage === 'enrolled') { res.status(400).json({ error: 'Already enrolled' }); return; }

    const cls = await prisma.class.findFirst({ where: { id: class_id, org_id: orgId } });
    if (!cls) { res.status(404).json({ error: 'Select a valid class' }); return; }

    // Split the applicant's name into first / last.
    const parts = admission.student_name.trim().split(/\s+/);
    const first_name = parts[0];
    const last_name = parts.slice(1).join(' ') || parts[0];

    // Resolve a unique roll number (use the given one, or generate).
    let roll = roll_number?.trim();
    if (roll) {
      const clash = await prisma.student.findUnique({ where: { roll_number_org_id: { roll_number: roll, org_id: orgId } } });
      if (clash) { res.status(409).json({ error: 'Roll number already exists' }); return; }
    } else {
      const count = await prisma.student.count({ where: { org_id: orgId } });
      let n = count + 1;
      // Ensure uniqueness in the rare case of a gap/collision.
      while (await prisma.student.findUnique({ where: { roll_number_org_id: { roll_number: `ADM-${n}`, org_id: orgId } } })) n++;
      roll = `ADM-${n}`;
    }

    const student = await prisma.student.create({
      data: {
        first_name, last_name, roll_number: roll,
        date_of_birth: admission.date_of_birth || '2000-01-01',
        gender: admission.gender || 'unspecified',
        class_id, parent_name: admission.guardian_name,
        parent_phone: parent_phone?.trim() || admission.phone || 'N/A',
        entered_by: req.user!.userId, org_id: orgId,
      },
      include: { class: { select: { id: true, name: true, section: true } } },
    });

    await prisma.admission.update({ where: { id }, data: { stage: 'enrolled', student_id: student.id } });

    // Optionally invite the guardian to a parent account, linked to this student.
    let invite: { code: string; join_url: string } | null = null;
    if (create_parent_invite && admission.email) {
      const dup = await prisma.user.findUnique({ where: { email_org_id: { email: admission.email, org_id: orgId } } });
      if (!dup) {
        const created = await prisma.invitation.create({
          data: {
            code: makeCode(), role: 'parent', email: admission.email, name: admission.guardian_name,
            student_id: student.id, expires_at: new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000),
            created_by: req.user!.userId, org_id: orgId,
          },
        });
        const join_url = `${appUrl()}/join/${created.code}`;
        invite = { code: created.code, join_url };
        const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
        sendEmail({
          to: admission.email,
          subject: `Welcome to ${org?.name || 'our school'} — set up your parent account`,
          text: `${admission.student_name} is now enrolled at ${org?.name || 'our school'}.\n\n`
            + `Set up your parent account to follow their progress: ${join_url}\n\nThis link expires in ${INVITE_VALID_DAYS} days.`,
        }).catch((e) => console.error('convert invite email:', e));
      }
    }

    await audit(req, 'admission.enrolled', {
      targetType: 'admission', targetId: id,
      summary: `Enrolled ${admission.student_name} into ${cls.name}${cls.section ? ` - ${cls.section}` : ''}`,
      metadata: { student_id: student.id },
    });

    res.status(201).json({ message: `${admission.student_name} enrolled`, student, invite });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
