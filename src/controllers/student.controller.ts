import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma/client';

export async function createStudent(req: Request, res: Response): Promise<void> {
  try {
    const { first_name, last_name, roll_number, date_of_birth, gender, class_id, parent_name, parent_phone, address } = req.body;
    const orgId = req.user!.orgId;

    if (!first_name || !last_name || !roll_number || !date_of_birth || !gender || !class_id || !parent_name || !parent_phone) {
      res.status(400).json({ error: 'All required fields must be provided' }); return;
    }

    const classExists = await prisma.class.findFirst({ where: { id: class_id, org_id: orgId } });
    if (!classExists) { res.status(404).json({ error: 'Class not found' }); return; }

    const existingRoll = await prisma.student.findUnique({ where: { roll_number_org_id: { roll_number, org_id: orgId } } });
    if (existingRoll) { res.status(409).json({ error: 'Roll number already exists' }); return; }

    const student = await prisma.student.create({
      data: { first_name, last_name, roll_number, date_of_birth, gender, class_id, parent_name, parent_phone, address: address || null, entered_by: req.user?.userId || null, org_id: orgId },
      include: { class: { select: { id: true, name: true, section: true } } },
    });

    res.status(201).json({ message: 'Student added successfully', student });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listStudents(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const { class_id, search } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: any = { is_active: true, org_id: orgId };
    if (class_id) where.class_id = class_id;
    // Teachers only see students in their assigned classes
    if (req.user!.role === 'teacher') where.class = { class_teachers: { some: { teacher_id: req.user!.userId } } };
    if (search) {
      where.OR = [
        { first_name: { contains: search as string } },
        { last_name: { contains: search as string } },
        { roll_number: { contains: search as string } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          class: { select: { id: true, name: true, section: true } },
          parent_links: { include: { parent: { select: { id: true, name: true, email: true, is_active: true } } } },
        },
        skip, take: limit, orderBy: { roll_number: 'asc' },
      }),
      prisma.student.count({ where }),
    ]);

    // Expose linked parent accounts as a flat `parents` array
    const formatted = students.map((s) => ({ ...s, parents: s.parent_links.map((l) => l.parent), parent_links: undefined }));
    res.json({ students: formatted, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getStudent(req: Request, res: Response): Promise<void> {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id as string, org_id: req.user!.orgId },
      include: {
        class: { select: { id: true, name: true, section: true, academic_year: true } },
        parent_links: { include: { parent: { select: { id: true, name: true, email: true, is_active: true } } } },
      },
    });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }
    res.json({ student: { ...student, parents: student.parent_links.map((l) => l.parent), parent_links: undefined } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Optional student photo — shown in the app and printed on the marksheet
export async function uploadStudentPhoto(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const student = await prisma.student.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }
    if (!req.file) { res.status(400).json({ error: 'A photo file is required' }); return; }

    // replace any previous photo
    if (student.photo_path) fs.unlink(path.resolve('uploads', student.photo_path), () => {});

    const updated = await prisma.student.update({
      where: { id },
      data: { photo_path: req.file.filename },
    });
    res.json({ message: 'Photo uploaded', photo_path: updated.photo_path });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function removeStudentPhoto(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const student = await prisma.student.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    if (student.photo_path) fs.unlink(path.resolve('uploads', student.photo_path), () => {});
    await prisma.student.update({ where: { id }, data: { photo_path: null } });
    res.json({ message: 'Photo removed' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateStudent(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { first_name, last_name, date_of_birth, gender, parent_name, parent_phone, address } = req.body;

    const existing = await prisma.student.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Student not found' }); return; }

    const student = await prisma.student.update({
      where: { id },
      data: { ...(first_name && { first_name }), ...(last_name && { last_name }), ...(date_of_birth && { date_of_birth }), ...(gender && { gender }), ...(parent_name && { parent_name }), ...(parent_phone && { parent_phone }), ...(address !== undefined && { address: address || null }) },
      include: { class: { select: { id: true, name: true, section: true } } },
    });
    res.json({ message: 'Student updated successfully', student });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function transferStudent(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { class_id } = req.body;
    if (!class_id) { res.status(400).json({ error: 'New class ID is required' }); return; }

    const classExists = await prisma.class.findFirst({ where: { id: class_id, org_id: req.user!.orgId } });
    if (!classExists) { res.status(404).json({ error: 'Target class not found' }); return; }

    const student = await prisma.student.update({
      where: { id },
      data: { class_id },
      include: { class: { select: { id: true, name: true, section: true } } },
    });
    res.json({ message: 'Student transferred successfully', student });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteStudent(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.student.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Student not found' }); return; }

    await prisma.student.update({ where: { id }, data: { is_active: false } });
    res.json({ message: 'Student removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
