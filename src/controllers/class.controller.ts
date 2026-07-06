import { Request, Response } from 'express';
import prisma from '../prisma/client';

const classInclude = {
  class_teachers: { include: { teacher: { select: { id: true, name: true, email: true, subject: true } } } },
  _count: { select: { students: true } },
};

// Flatten the join rows into a simple teachers array for the frontend
function shapeClass(cls: any) {
  const { class_teachers, ...rest } = cls;
  return { ...rest, teachers: class_teachers.map((ct: any) => ct.teacher) };
}

async function setClassTeachers(classId: string, teacherIds: string[], orgId: string) {
  // Only accept active teachers belonging to this org
  const valid = await prisma.user.findMany({
    where: { id: { in: teacherIds }, role: 'teacher', org_id: orgId },
    select: { id: true },
  });
  await prisma.classTeacher.deleteMany({ where: { class_id: classId } });
  for (const t of valid) {
    await prisma.classTeacher.create({ data: { class_id: classId, teacher_id: t.id } }).catch(() => {});
  }
}

export async function createClass(req: Request, res: Response): Promise<void> {
  try {
    const { name, section, academic_year, teacher_ids } = req.body;
    const orgId = req.user!.orgId;

    if (!name || !academic_year) {
      res.status(400).json({ error: 'Name and academic year are required' });
      return;
    }

    const sectionValue = section || '';
    const existing = await prisma.class.findFirst({ where: { name, section: sectionValue, academic_year, org_id: orgId } });
    if (existing) {
      res.status(409).json({ error: 'Class with this name, section, and academic year already exists' });
      return;
    }

    const created = await prisma.class.create({
      data: { name, section: sectionValue, academic_year, org_id: orgId },
    });

    if (Array.isArray(teacher_ids) && teacher_ids.length > 0) {
      await setClassTeachers(created.id, teacher_ids, orgId);
    }

    const newClass = await prisma.class.findUnique({ where: { id: created.id }, include: classInclude });
    res.status(201).json({ message: 'Class created successfully', class: shapeClass(newClass) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listClasses(req: Request, res: Response): Promise<void> {
  try {
    const where: any = { org_id: req.user!.orgId };
    // Teachers only see classes assigned to them
    if (req.user!.role === 'teacher') where.class_teachers = { some: { teacher_id: req.user!.userId } };

    const classes = await prisma.class.findMany({
      where,
      include: classInclude,
      orderBy: [{ name: 'asc' }, { section: 'asc' }],
    });
    res.json({ classes: classes.map(shapeClass) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getClass(req: Request, res: Response): Promise<void> {
  try {
    const where: any = { id: req.params.id as string, org_id: req.user!.orgId };
    if (req.user!.role === 'teacher') where.class_teachers = { some: { teacher_id: req.user!.userId } };

    const cls = await prisma.class.findFirst({ where, include: classInclude });
    if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }
    res.json({ class: shapeClass(cls) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateClass(req: Request, res: Response): Promise<void> {
  try {
    const { name, section, academic_year, teacher_ids } = req.body;
    const id = req.params.id as string;
    const orgId = req.user!.orgId;
    const existing = await prisma.class.findFirst({ where: { id, org_id: orgId } });
    if (!existing) { res.status(404).json({ error: 'Class not found' }); return; }

    await prisma.class.update({
      where: { id },
      data: { ...(name && { name }), ...(section !== undefined && { section: section || '' }), ...(academic_year && { academic_year }) },
    });

    if (teacher_ids !== undefined && Array.isArray(teacher_ids)) {
      await setClassTeachers(id, teacher_ids, orgId);
    }

    const updated = await prisma.class.findUnique({ where: { id }, include: classInclude });
    res.json({ message: 'Class updated successfully', class: shapeClass(updated) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteClass(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.class.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Class not found' }); return; }

    const studentCount = await prisma.student.count({ where: { class_id: id } });
    if (studentCount > 0) { res.status(400).json({ error: 'Cannot delete class with enrolled students' }); return; }

    await prisma.classTeacher.deleteMany({ where: { class_id: id } });
    await prisma.class.delete({ where: { id } });
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
