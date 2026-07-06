import { Request, Response } from 'express';
import path from 'path';
import prisma from '../prisma/client';
import { generateReportCardPDF } from '../utils/pdfReportCard';
import { canAccessClass } from '../utils/classAccess';

interface GradeRule { min: number; max: number; grade: string; remark: string; }

const DEFAULT_GRADING: GradeRule[] = [
  { min: 90, max: 100, grade: 'A+', remark: 'Outstanding' },
  { min: 80, max: 89, grade: 'A', remark: 'Excellent' },
  { min: 70, max: 79, grade: 'B+', remark: 'Very Good' },
  { min: 60, max: 69, grade: 'B', remark: 'Good' },
  { min: 50, max: 59, grade: 'C', remark: 'Satisfactory' },
  { min: 40, max: 49, grade: 'D', remark: 'Needs Improvement' },
  { min: 0, max: 39, grade: 'F', remark: 'Fail' },
];

function parseGrading(raw: string | undefined): GradeRule[] {
  if (!raw) return DEFAULT_GRADING;
  try {
    let parsed = JSON.parse(raw);
    // Handle double-encoded JSON
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return Array.isArray(parsed) ? parsed : DEFAULT_GRADING;
  } catch {
    return DEFAULT_GRADING;
  }
}

function getGrade(percentage: number, rules: GradeRule[]): { grade: string; remark: string } {
  for (const r of rules) {
    if (percentage >= r.min && percentage <= r.max) return { grade: r.grade, remark: r.remark };
  }
  return { grade: 'N/A', remark: '' };
}

export async function getReportCard(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.params.studentId as string;
    const orgId = req.user!.orgId;

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        org_id: orgId,
        // Teachers can only open report cards for students in their assigned classes
        ...(req.user!.role === 'teacher' ? { class: { class_teachers: { some: { teacher_id: req.user!.userId } } } } : {}),
      },
      include: { class: true },
    });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const config = await prisma.reportCardConfig.findUnique({ where: { org_id: orgId } });
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const gradingRules = parseGrading(config?.grading_system);

    // Check for unapproved exams in the student's class
    const unapprovedCount = await prisma.exam.count({
      where: { class_id: student.class_id, org_id: orgId, approval_status: { not: 'approved' } },
    });
    const totalExamCount = await prisma.exam.count({
      where: { class_id: student.class_id, org_id: orgId },
    });

    if (unapprovedCount > 0 && totalExamCount > 0) {
      const approvedCount = totalExamCount - unapprovedCount;
      res.status(400).json({
        error: 'Report card cannot be generated — some marks are not approved yet.',
        details: { total: totalExamCount, approved: approvedCount, pending: unapprovedCount },
      });
      return;
    }

    // Get marks only from approved exams
    const marks = await prisma.mark.findMany({
      where: { student_id: studentId, exam: { approval_status: 'approved' } },
      include: { exam: { include: { subject: true } } },
    });

    // Group by subject, then by exam_type and term
    const subjectMap = new Map<string, {
      subject: { id: string; name: string; code: string };
      exams: { exam_type: string; term: string; name: string; marks_obtained: number; max_marks: number }[];
      totalObtained: number;
      totalMax: number;
    }>();

    for (const m of marks) {
      const subId = m.exam.subject.id;
      if (!subjectMap.has(subId)) {
        subjectMap.set(subId, {
          subject: m.exam.subject,
          exams: [],
          totalObtained: 0,
          totalMax: 0,
        });
      }
      const entry = subjectMap.get(subId)!;
      entry.exams.push({
        exam_type: m.exam.exam_type,
        term: m.exam.term,
        name: m.exam.name,
        marks_obtained: m.marks_obtained,
        max_marks: m.exam.max_marks,
      });
      entry.totalObtained += m.marks_obtained;
      entry.totalMax += m.exam.max_marks;
    }

    const subjects = Array.from(subjectMap.values()).map((s) => {
      const percentage = s.totalMax > 0 ? Math.round((s.totalObtained / s.totalMax) * 100) : 0;
      const { grade, remark } = getGrade(percentage, gradingRules);
      return { ...s, percentage, grade, remark };
    });

    // Overall totals
    const grandTotalObtained = subjects.reduce((sum, s) => sum + s.totalObtained, 0);
    const grandTotalMax = subjects.reduce((sum, s) => sum + s.totalMax, 0);
    const overallPercentage = grandTotalMax > 0 ? Math.round((grandTotalObtained / grandTotalMax) * 100) : 0;
    const overall = getGrade(overallPercentage, gradingRules);

    // Attendance summary
    let attendanceSummary = null;
    if (!config || config.show_attendance) {
      const attendance = await prisma.attendance.findMany({ where: { student_id: studentId } });
      const total = attendance.length;
      const present = attendance.filter((a) => a.status === 'present').length;
      attendanceSummary = {
        total,
        present,
        absent: attendance.filter((a) => a.status === 'absent').length,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    }

    // Exam types present
    const examTypes = [...new Set(marks.map((m) => m.exam.exam_type))];
    const terms = [...new Set(marks.map((m) => m.exam.term))].sort();

    res.json({
      student: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        roll_number: student.roll_number,
        date_of_birth: student.date_of_birth,
        gender: student.gender,
        parent_name: student.parent_name,
        class_name: `${student.class.name}${student.class.section ? ' - ' + student.class.section : ''}`,
        academic_year: student.class.academic_year,
        photo_path: student.photo_path,
      },
      subjects,
      examTypes,
      terms,
      summary: {
        totalObtained: grandTotalObtained,
        totalMax: grandTotalMax,
        percentage: overallPercentage,
        grade: overall.grade,
        remark: overall.remark,
      },
      attendance: attendanceSummary,
      config: {
        institute_name: config?.institute_name || org?.name || '',
        institute_logo: config?.institute_logo || null,
        address_line: config?.address_line || org?.address || '',
        tagline: config?.tagline || '',
        show_attendance: config?.show_attendance ?? true,
        show_photo: config?.show_photo ?? true,
        show_grade: config?.show_grade ?? true,
        show_percentage: config?.show_percentage ?? true,
        show_rank: config?.show_rank ?? false,
        show_remarks: config?.show_remarks ?? true,
        principal_name: config?.principal_name || '',
        grading_system: gradingRules,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getClassReportSummary(req: Request, res: Response): Promise<void> {
  try {
    const classId = req.params.classId as string;
    const orgId = req.user!.orgId;

    if (req.user!.role === 'teacher' && !(await canAccessClass(req.user!, classId))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    const students = await prisma.student.findMany({
      where: { class_id: classId, is_active: true, org_id: orgId },
      orderBy: { roll_number: 'asc' },
    });

    const results = [];
    for (const student of students) {
      const marks = await prisma.mark.findMany({
        where: { student_id: student.id },
        include: { exam: true },
      });
      const totalObtained = marks.reduce((sum, m) => sum + m.marks_obtained, 0);
      const totalMax = marks.reduce((sum, m) => sum + m.exam.max_marks, 0);
      const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

      results.push({
        student_id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        roll_number: student.roll_number,
        totalObtained,
        totalMax,
        percentage,
      });
    }

    results.sort((a, b) => b.percentage - a.percentage);
    results.forEach((r, i) => (r as any).rank = i + 1);

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getReportConfig(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    let config = await prisma.reportCardConfig.findUnique({ where: { org_id: orgId } });
    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    if (!config) {
      config = await prisma.reportCardConfig.create({
        data: { org_id: orgId, institute_name: org?.name, address_line: org?.address },
      });
    }
    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateReportConfig(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const { institute_name, address_line, tagline, show_attendance, show_photo, show_grade, show_percentage,
      show_rank, show_remarks, principal_name, grading_system } = req.body;

    const data: any = {};
    if (institute_name !== undefined) data.institute_name = institute_name;
    if (address_line !== undefined) data.address_line = address_line;
    if (tagline !== undefined) data.tagline = tagline;
    if (show_attendance !== undefined) data.show_attendance = show_attendance;
    if (show_photo !== undefined) data.show_photo = show_photo;
    if (show_grade !== undefined) data.show_grade = show_grade;
    if (show_percentage !== undefined) data.show_percentage = show_percentage;
    if (show_rank !== undefined) data.show_rank = show_rank;
    if (show_remarks !== undefined) data.show_remarks = show_remarks;
    if (principal_name !== undefined) data.principal_name = principal_name;
    if (grading_system !== undefined) data.grading_system = JSON.stringify(grading_system);

    let config = await prisma.reportCardConfig.findUnique({ where: { org_id: orgId } });
    if (config) {
      config = await prisma.reportCardConfig.update({ where: { org_id: orgId }, data });
    } else {
      config = await prisma.reportCardConfig.create({ data: { org_id: orgId, ...data } });
    }

    res.json({ message: 'Config updated', config });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function downloadReportCardPDF(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.params.studentId as string;
    const orgId = req.user!.orgId;

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        org_id: orgId,
        // Teachers can only open report cards for students in their assigned classes
        ...(req.user!.role === 'teacher' ? { class: { class_teachers: { some: { teacher_id: req.user!.userId } } } } : {}),
      },
      include: { class: true },
    });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const config = await prisma.reportCardConfig.findUnique({ where: { org_id: orgId } });
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const gradingRules = parseGrading(config?.grading_system);

    // Block if unapproved exams exist
    const unapprovedCount = await prisma.exam.count({
      where: { class_id: student.class_id, org_id: orgId, approval_status: { not: 'approved' } },
    });
    const totalExamCount = await prisma.exam.count({
      where: { class_id: student.class_id, org_id: orgId },
    });
    if (unapprovedCount > 0 && totalExamCount > 0) {
      res.status(400).json({ error: 'Report card cannot be generated — some marks are not approved yet.' });
      return;
    }

    const marks = await prisma.mark.findMany({
      where: { student_id: studentId, exam: { approval_status: 'approved' } },
      include: { exam: { include: { subject: true } } },
    });

    const subjectMap = new Map<string, any>();
    for (const m of marks) {
      const subId = m.exam.subject.id;
      if (!subjectMap.has(subId)) {
        subjectMap.set(subId, { subject: m.exam.subject, exams: [], totalObtained: 0, totalMax: 0 });
      }
      const entry = subjectMap.get(subId)!;
      entry.exams.push({ exam_type: m.exam.exam_type, marks_obtained: m.marks_obtained, max_marks: m.exam.max_marks });
      entry.totalObtained += m.marks_obtained;
      entry.totalMax += m.exam.max_marks;
    }

    const subjects = Array.from(subjectMap.values()).map((s) => {
      const percentage = s.totalMax > 0 ? Math.round((s.totalObtained / s.totalMax) * 100) : 0;
      const { grade } = getGrade(percentage, gradingRules);
      return { ...s, percentage, grade };
    });

    const grandTotalObtained = subjects.reduce((sum: number, s: any) => sum + s.totalObtained, 0);
    const grandTotalMax = subjects.reduce((sum: number, s: any) => sum + s.totalMax, 0);
    const overallPercentage = grandTotalMax > 0 ? Math.round((grandTotalObtained / grandTotalMax) * 100) : 0;
    const overall = getGrade(overallPercentage, gradingRules);

    let attendanceSummary = null;
    if (!config || config.show_attendance) {
      const attendance = await prisma.attendance.findMany({ where: { student_id: studentId } });
      const total = attendance.length;
      const present = attendance.filter((a) => a.status === 'present').length;
      attendanceSummary = { total, present, absent: total - present, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
    }

    const examTypes = [...new Set(marks.map((m) => m.exam.exam_type))];

    // Determine logo path
    let logoPath: string | undefined;
    if (config?.institute_logo) {
      logoPath = path.resolve('uploads', config.institute_logo);
    }

    const reportData = {
      student: {
        name: `${student.first_name} ${student.last_name}`,
        roll_number: student.roll_number,
        date_of_birth: student.date_of_birth,
        gender: student.gender,
        parent_name: student.parent_name,
        class_name: `${student.class.name}${student.class.section ? ' - ' + student.class.section : ''}`,
        academic_year: student.class.academic_year,
        photo_path: (config?.show_photo ?? true) && student.photo_path
          ? path.resolve('uploads', student.photo_path)
          : undefined,
      },
      subjects,
      examTypes,
      summary: { totalObtained: grandTotalObtained, totalMax: grandTotalMax, percentage: overallPercentage, grade: overall.grade, remark: overall.remark },
      attendance: attendanceSummary,
      config: {
        institute_name: config?.institute_name || org?.name || '',
        address_line: config?.address_line || org?.address || '',
        tagline: config?.tagline || '',
        show_attendance: config?.show_attendance ?? true,
        show_grade: config?.show_grade ?? true,
        show_percentage: config?.show_percentage ?? true,
        show_remarks: config?.show_remarks ?? true,
        principal_name: config?.principal_name || '',
        logo_path: logoPath,
        grading_system: gradingRules,
      },
    };

    const doc = generateReportCardPDF(reportData);
    const fileName = `Report_Card_${student.roll_number}_${student.first_name}_${student.last_name}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function uploadLogo(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileName = req.file.filename;

    let config = await prisma.reportCardConfig.findUnique({ where: { org_id: orgId } });
    if (config) {
      config = await prisma.reportCardConfig.update({ where: { org_id: orgId }, data: { institute_logo: fileName } });
    } else {
      config = await prisma.reportCardConfig.create({ data: { org_id: orgId, institute_logo: fileName } });
    }

    res.json({ message: 'Logo uploaded', logo: fileName });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
