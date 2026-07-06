import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { canAccessClass } from '../utils/classAccess';

export async function enterMarks(req: Request, res: Response): Promise<void> {
  try {
    const { exam_id, records } = req.body;
    const orgId = req.user!.orgId;

    if (!exam_id || !records || !Array.isArray(records)) {
      res.status(400).json({ error: 'exam_id and records array required' }); return;
    }

    const exam = await prisma.exam.findFirst({ where: { id: exam_id, org_id: orgId } });
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return; }

    if (!(await canAccessClass(req.user!, exam.class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    let count = 0;
    for (const r of records) {
      if (!r.student_id || r.marks_obtained === undefined) continue;
      if (r.marks_obtained > exam.max_marks) continue;

      const existing = await prisma.mark.findUnique({
        where: { student_id_exam_id: { student_id: r.student_id, exam_id } },
      });

      if (existing) {
        await prisma.mark.update({
          where: { id: existing.id },
          data: { marks_obtained: parseFloat(r.marks_obtained), remarks: r.remarks || null, entered_by: req.user?.userId },
        });
      } else {
        await prisma.mark.create({
          data: {
            student_id: r.student_id, exam_id, marks_obtained: parseFloat(r.marks_obtained),
            remarks: r.remarks || null, entered_by: req.user?.userId, org_id: orgId,
          },
        });
      }
      count++;
    }

    res.json({ message: `Marks saved for ${count} students`, count });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMarksForExam(req: Request, res: Response): Promise<void> {
  try {
    const examId = req.params.examId as string;
    const exam = await prisma.exam.findFirst({
      where: { id: examId, org_id: req.user!.orgId },
      include: { subject: true, class: true },
    });
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return; }

    const students = await prisma.student.findMany({
      where: { class_id: exam.class_id, is_active: true },
      orderBy: { roll_number: 'asc' },
      select: { id: true, first_name: true, last_name: true, roll_number: true },
    });

    const marks = await prisma.mark.findMany({ where: { exam_id: examId } });
    const markMap = new Map(marks.map((m) => [m.student_id, m]));

    const result = students.map((s) => ({
      student_id: s.id, first_name: s.first_name, last_name: s.last_name, roll_number: s.roll_number,
      marks_obtained: markMap.get(s.id)?.marks_obtained ?? null,
      remarks: markMap.get(s.id)?.remarks ?? null,
    }));

    res.json({ exam, marks: result, max_marks: exam.max_marks });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getStudentMarks(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.params.studentId as string;
    const marks = await prisma.mark.findMany({
      where: { student_id: studentId, org_id: req.user!.orgId },
      include: {
        exam: {
          include: { subject: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { exam: { term: 'asc' } },
    });

    res.json({ marks });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
