import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

export async function registerOrganization(req: Request, res: Response): Promise<void> {
  try {
    const { org_name, org_email, org_phone, org_address, admin_name, admin_email, admin_password } = req.body;

    if (!org_name || !org_email || !admin_name || !admin_email || !admin_password) {
      res.status(400).json({ error: 'Organization name, email, admin name, email, and password are required' });
      return;
    }

    // Generate slug from org name
    const slug = org_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existingOrg = await prisma.organization.findUnique({ where: { slug } });
    if (existingOrg) {
      res.status(409).json({ error: 'An organization with a similar name already exists. Try a different name.' });
      return;
    }

    // Check if admin email exists in same potential org
    const hashedPassword = await hashPassword(admin_password);

    // Create org and admin in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: org_name,
          slug,
          email: org_email,
          phone: org_phone || null,
          address: org_address || null,
        },
      });

      const admin = await tx.user.create({
        data: {
          name: admin_name,
          email: admin_email,
          password: hashedPassword,
          role: 'admin',
          org_id: org.id,
        },
        select: { id: true, name: true, email: true, role: true, org_id: true },
      });

      // Seed default grade levels
      const defaultGrades = [
        'Nursery', 'LKG', 'UKG',
        'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
        'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
        'Class 11', 'Class 12',
      ];

      await tx.gradeLevel.createMany({
        data: defaultGrades.map((name, i) => ({
          name,
          display_order: i,
          org_id: org.id,
        })),
      });

      return { org, admin };
    });

    const token = generateToken({
      userId: result.admin.id,
      email: result.admin.email,
      role: result.admin.role,
      orgId: result.org.id,
    });

    res.status(201).json({
      message: 'Organization registered successfully',
      token,
      org: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
      },
      user: result.admin,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getOrganization(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true, name: true, slug: true, email: true, phone: true,
        address: true, logo_url: true, is_active: true, created_at: true,
      },
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({ org });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateOrganization(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const { name, email, phone, address } = req.body;

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(address !== undefined && { address: address || null }),
      },
      select: { id: true, name: true, slug: true, email: true, phone: true, address: true },
    });

    res.json({ message: 'Organization updated', org });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
