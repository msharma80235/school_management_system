import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { audit } from '../utils/audit';

// Platform-wide stats
export async function platformStats(_req: Request, res: Response): Promise<void> {
  try {
    const [orgs, activeOrgs, students, teachers, parents] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { is_active: true } }),
      prisma.student.count({ where: { is_active: true } }),
      prisma.user.count({ where: { role: 'teacher' } }),
      prisma.user.count({ where: { role: 'parent' } }),
    ]);
    const users = await prisma.user.count({ where: { org_id: { not: null } } });
    res.json({ orgs, activeOrgs, students, teachers, parents, users });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// All organizations with usage counts
export async function listOrgs(_req: Request, res: Response): Promise<void> {
  try {
    const orgs = await prisma.organization.findMany({
      include: {
        _count: { select: { users: true, students: true, classes: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({ orgs });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Enable/disable an organization — disabling blocks every login and every
// existing session of that org immediately (enforced in auth middleware)
export async function toggleOrgStatus(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Organization not found' }); return; }

    const org = await prisma.organization.update({
      where: { id },
      data: { is_active: !existing.is_active },
      include: { _count: { select: { users: true, students: true, classes: true } } },
    });

    await audit(req, org.is_active ? 'org.enable' : 'org.disable', {
      orgId: org.id, targetType: 'organization', targetId: org.id,
      summary: `${org.is_active ? 'Enabled' : 'Disabled'} organization "${org.name}"`,
    });

    res.json({
      message: `Organization "${org.name}" ${org.is_active ? 'enabled' : 'disabled'}`,
      org,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

const adminSelect = { id: true, name: true, email: true, is_active: true, created_at: true };

// List an organization's admin accounts
export async function listOrgAdmins(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }

    const admins = await prisma.user.findMany({
      where: { org_id: id, role: 'admin' },
      select: adminSelect,
      orderBy: { created_at: 'asc' },
    });
    res.json({ org: { id: org.id, name: org.name }, admins });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update an org admin's name, email, and/or password
export async function updateOrgAdmin(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.params.id as string;
    const adminId = req.params.adminId as string;
    const { name, email, new_password } = req.body;

    const admin = await prisma.user.findFirst({ where: { id: adminId, org_id: orgId, role: 'admin' } });
    if (!admin) { res.status(404).json({ error: 'Admin account not found' }); return; }

    if (email && email !== admin.email) {
      const dup = await prisma.user.findUnique({ where: { email_org_id: { email, org_id: orgId } } });
      if (dup) { res.status(409).json({ error: 'Email already in use in this organization' }); return; }
    }
    if (new_password && new_password.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const data: any = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (new_password) data.password = await hashPassword(new_password);

    const updated = await prisma.user.update({ where: { id: adminId }, data, select: adminSelect });
    await audit(req, 'org.admin_update', {
      orgId, targetType: 'user', targetId: adminId,
      summary: `Updated admin account ${updated.email}${new_password ? ' (password changed)' : ''}`,
    });
    res.json({ message: 'Admin account updated', admin: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Add a new admin account to an organization (e.g. a new principal)
export async function createOrgAdmin(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.params.id as string;
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }

    const dup = await prisma.user.findUnique({ where: { email_org_id: { email, org_id: orgId } } });
    if (dup) { res.status(409).json({ error: 'Email already in use in this organization' }); return; }

    const hashed = await hashPassword(password);
    const admin = await prisma.user.create({
      data: { name, email, password: hashed, role: 'admin', org_id: orgId },
      select: adminSelect,
    });

    await audit(req, 'org.admin_create', {
      orgId, targetType: 'user', targetId: admin.id,
      summary: `Added admin ${admin.email} to "${org.name}"`,
    });

    res.status(201).json({ message: `Admin added to "${org.name}"`, admin });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Activate/deactivate an org admin — an org must always keep one active admin
export async function toggleOrgAdminStatus(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.params.id as string;
    const adminId = req.params.adminId as string;

    const admin = await prisma.user.findFirst({ where: { id: adminId, org_id: orgId, role: 'admin' } });
    if (!admin) { res.status(404).json({ error: 'Admin account not found' }); return; }

    if (admin.is_active) {
      const otherActive = await prisma.user.count({
        where: { org_id: orgId, role: 'admin', is_active: true, id: { not: adminId } },
      });
      if (otherActive === 0) {
        res.status(400).json({ error: 'Cannot deactivate the only active admin. Add another admin first.' });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id: adminId },
      data: { is_active: !admin.is_active },
      select: adminSelect,
    });
    await audit(req, updated.is_active ? 'org.admin_activate' : 'org.admin_deactivate', {
      orgId, targetType: 'user', targetId: adminId,
      summary: `${updated.is_active ? 'Activated' : 'Deactivated'} admin ${updated.email}`,
    });
    res.json({ message: `Admin ${updated.is_active ? 'activated' : 'deactivated'}`, admin: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Reset the password of an organization's admin account(s)
export async function resetOrgAdminPassword(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }

    const admins = await prisma.user.findMany({ where: { org_id: id, role: 'admin' } });
    if (admins.length === 0) {
      res.status(404).json({ error: 'No admin account found for this organization' });
      return;
    }

    const hashed = await hashPassword(new_password);
    await prisma.user.updateMany({ where: { org_id: id, role: 'admin' }, data: { password: hashed } });

    await audit(req, 'org.admin_password_reset', {
      orgId: id, targetType: 'organization', targetId: id,
      summary: `Reset password for ${admins.length} admin account(s) of "${org.name}"`,
      metadata: { admins: admins.map((a) => a.email) },
    });

    res.json({
      message: `Password reset for ${admins.length} admin account(s) of "${org.name}"`,
      admins: admins.map((a) => a.email),
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
