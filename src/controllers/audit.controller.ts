import { Request, Response } from 'express';
import prisma from '../prisma/client';

// Read-only view of the audit trail. Admins see their own org's entries;
// the platform super admin sees everything. There is intentionally no create/
// update/delete endpoint — rows are written only by the internal audit() helper.
export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const { action, actor_id, from, to, limit } = req.query as Record<string, string>;

    const where: any = {};
    if (req.user!.role !== 'superadmin') {
      where.org_id = req.user!.orgId;
    }
    if (action) where.action = { contains: action };
    if (actor_id) where.actor_id = actor_id;
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to);
    }

    const take = Math.min(Number(limit) || 200, 1000);

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take,
    });

    // Attach the actor's current name (logs store ids so they survive deletion,
    // but the UI reads better with names when the account still exists).
    const actorIds = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    const enriched = logs.map((l) => ({
      ...l,
      metadata: l.metadata ? JSON.parse(l.metadata) : null,
      actor: l.actor_id ? actorMap.get(l.actor_id) || null : null,
    }));

    res.json({ logs: enriched, count: enriched.length });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
