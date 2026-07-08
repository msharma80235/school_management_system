import { Request } from 'express';
import prisma from '../prisma/client';

interface AuditDetails {
  targetType?: string;
  targetId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
  // Super-admin actions aren't tied to the actor's own org; pass the affected
  // org explicitly. Defaults to the actor's org (req.user.orgId).
  orgId?: string | null;
}

// Record a privileged action. Best-effort by design: an audit-write failure is
// logged but never propagated, so it can't break the action the user requested.
// The trail is append-only — this helper only ever creates rows.
export async function audit(req: Request, action: string, details: AuditDetails = {}): Promise<void> {
  try {
    const orgId = details.orgId !== undefined ? details.orgId : (req.user?.orgId || null);
    await prisma.auditLog.create({
      data: {
        org_id: orgId,
        actor_id: req.user?.userId || null,
        actor_name: null,
        actor_role: req.user?.role || null,
        action,
        target_type: details.targetType || null,
        target_id: details.targetId || null,
        summary: details.summary || null,
        metadata: details.metadata ? JSON.stringify(details.metadata) : null,
      },
    });
  } catch (err) {
    console.error(`audit log failed for action "${action}":`, err);
  }
}
