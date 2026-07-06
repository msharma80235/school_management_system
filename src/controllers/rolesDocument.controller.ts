import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { generateRolesPdf, DEFAULT_ROLES_SECTIONS, RolesSection } from '../utils/rolesPdf';

function parseSections(raw: string | undefined): RolesSection[] {
  if (!raw) return DEFAULT_ROLES_SECTIONS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ROLES_SECTIONS;
  } catch {
    return DEFAULT_ROLES_SECTIONS;
  }
}

// Admin: get the editable roles & duties content (defaults if never saved)
export async function getRolesDocument(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const stored = await prisma.rolesDocument.findUnique({ where: { org_id: orgId } });
    const published = await prisma.schoolDocument.findFirst({
      where: { org_id: orgId, title: stored?.title || 'Roles & Responsibilities' },
    });

    res.json({
      title: stored?.title || 'Roles & Responsibilities',
      sections: parseSections(stored?.sections),
      audience: published?.audience || 'teacher,volunteer,staff',
      file_path: published?.file_path || null,
      updated_at: stored?.updated_at || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: save content, regenerate the PDF, and (re)publish it as a school document
export async function saveRolesDocument(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const { title, sections, audience } = req.body;

    if (!title || !Array.isArray(sections) || sections.length === 0) {
      res.status(400).json({ error: 'Title and at least one section are required' });
      return;
    }

    const clean: RolesSection[] = sections
      .map((s: any) => ({
        heading: String(s.heading || '').trim(),
        note: s.note ? String(s.note).trim() : undefined,
        duties: Array.isArray(s.duties) ? s.duties.map((d: any) => String(d).trim()).filter(Boolean) : [],
      }))
      .filter((s: RolesSection) => s.heading && s.duties.length > 0);

    if (clean.length === 0) {
      res.status(400).json({ error: 'Each section needs a heading and at least one duty' });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    // Persist editable content
    await prisma.rolesDocument.upsert({
      where: { org_id: orgId },
      update: { title, sections: JSON.stringify(clean) },
      create: { org_id: orgId, title, sections: JSON.stringify(clean) },
    });

    // Regenerate the PDF (stable filename per org so links keep working)
    const fileName = `doc-roles-duties-${org!.slug}.pdf`;
    await generateRolesPdf(fileName, org!.name, title, clean);

    // Publish/update the school document entry
    const existing = await prisma.schoolDocument.findFirst({
      where: { org_id: orgId, title },
    });
    const docData = {
      title,
      description: 'Duties of class teachers, co-teachers, administrative staff, and volunteers',
      category: 'general',
      file_path: fileName,
      audience: audience || 'teacher,volunteer,staff',
      uploaded_by: req.user!.userId,
    };
    const published = existing
      ? await prisma.schoolDocument.update({ where: { id: existing.id }, data: docData })
      : await prisma.schoolDocument.create({ data: { ...docData, org_id: orgId } });

    res.json({ message: 'Roles & duties document updated and republished', file_path: published.file_path });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
