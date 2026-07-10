import { Request, Response } from 'express';
import prisma from '../prisma/client';

// Thresholds for the "at-risk" flags.
const LOW_ATTENDANCE = 75;   // percent
const LOW_AVERAGE = 40;      // percent
const MIN_ATTENDANCE_DAYS = 5; // ignore students with too little data to judge

function monthsAgoDate(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

// Per-student attendance and average-mark metrics for one org. Shared by the
// at-risk list and the CSV export.
async function studentMetrics(orgId: string) {
  const [attendance, marks] = await Promise.all([
    prisma.attendance.findMany({ where: { org_id: orgId }, select: { student_id: true, status: true } }),
    prisma.mark.findMany({
      where: { org_id: orgId, exam: { approval_status: 'approved' } },
      select: { student_id: true, marks_obtained: true, exam: { select: { max_marks: true } } },
    }),
  ]);

  const att = new Map<string, { attended: number; total: number }>();
  for (const a of attendance) {
    const r = att.get(a.student_id) || { attended: 0, total: 0 };
    r.total++;
    if (a.status === 'present' || a.status === 'late') r.attended++;
    att.set(a.student_id, r);
  }

  const mk = new Map<string, { sum: number; count: number }>();
  for (const m of marks) {
    if (!m.exam.max_marks) continue;
    const pct = (m.marks_obtained / m.exam.max_marks) * 100;
    const r = mk.get(m.student_id) || { sum: 0, count: 0 };
    r.sum += pct; r.count++;
    mk.set(m.student_id, r);
  }
  return { att, mk };
}

// Headline numbers for the dashboard.
export async function overview(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId!;
    const [students, teachers, classes, subjects, attnByStatus, examsByStatus, admissionsByStage, unresolvedSafety] = await Promise.all([
      prisma.student.count({ where: { org_id: orgId, is_active: true } }),
      prisma.user.count({ where: { org_id: orgId, role: 'teacher' } }),
      prisma.class.count({ where: { org_id: orgId } }),
      prisma.subject.count({ where: { org_id: orgId } }),
      prisma.attendance.groupBy({ by: ['status'], where: { org_id: orgId }, _count: true }),
      prisma.exam.groupBy({ by: ['approval_status'], where: { org_id: orgId }, _count: true }),
      prisma.admission.groupBy({ by: ['stage'], where: { org_id: orgId }, _count: true }),
      prisma.contentScanResult.count({ where: { org_id: orgId, status: { not: 'clean' }, resolution: null } }),
    ]);

    const attnCounts: Record<string, number> = {};
    attnByStatus.forEach((a) => { attnCounts[a.status] = a._count; });
    const attTotal = Object.values(attnCounts).reduce((s, n) => s + n, 0);
    const attended = (attnCounts.present || 0) + (attnCounts.late || 0);
    const attendanceRate = attTotal ? Math.round((attended / attTotal) * 100) : null;

    const examCounts: Record<string, number> = {};
    examsByStatus.forEach((e) => { examCounts[e.approval_status] = e._count; });

    const admissionCounts: Record<string, number> = {};
    admissionsByStage.forEach((a) => { admissionCounts[a.stage] = a._count; });

    res.json({
      students, teachers, classes, subjects,
      attendanceRate,
      exams: examCounts,
      admissions: admissionCounts,
      safetyUnresolved: unresolvedSafety,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Attendance rate by month for the last N months.
export async function attendanceTrend(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId!;
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
    const cutoff = monthsAgoDate(months);

    const rows = await prisma.attendance.findMany({
      where: { org_id: orgId, date: { gte: cutoff } },
      select: { date: true, status: true },
    });

    const byMonth = new Map<string, { present: number; absent: number; late: number; total: number }>();
    for (const r of rows) {
      const key = r.date.slice(0, 7); // YYYY-MM
      const m = byMonth.get(key) || { present: 0, absent: 0, late: 0, total: 0 };
      m.total++;
      if (r.status === 'present') m.present++;
      else if (r.status === 'absent') m.absent++;
      else if (r.status === 'late') m.late++;
      byMonth.set(key, m);
    }

    const trend = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, m]) => ({
        month, ...m,
        rate: m.total ? Math.round(((m.present + m.late) / m.total) * 100) : 0,
      }));

    res.json({ trend });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Distribution of approved-exam percentages, plus per-subject averages.
export async function gradeDistribution(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId!;
    const marks = await prisma.mark.findMany({
      where: { org_id: orgId, exam: { approval_status: 'approved' } },
      select: { marks_obtained: true, exam: { select: { max_marks: true, subject: { select: { name: true } } } } },
    });

    const buckets = [
      { label: '0–39', min: 0, max: 40, count: 0 },
      { label: '40–59', min: 40, max: 60, count: 0 },
      { label: '60–74', min: 60, max: 75, count: 0 },
      { label: '75–89', min: 75, max: 90, count: 0 },
      { label: '90–100', min: 90, max: 101, count: 0 },
    ];
    const bySubject = new Map<string, { sum: number; count: number }>();

    for (const m of marks) {
      if (!m.exam.max_marks) continue;
      const pct = (m.marks_obtained / m.exam.max_marks) * 100;
      const b = buckets.find((x) => pct >= x.min && pct < x.max);
      if (b) b.count++;
      const name = m.exam.subject?.name || 'Unknown';
      const r = bySubject.get(name) || { sum: 0, count: 0 };
      r.sum += pct; r.count++;
      bySubject.set(name, r);
    }

    const subjects = [...bySubject.entries()]
      .map(([subject, r]) => ({ subject, average: Math.round(r.sum / r.count) }))
      .sort((a, b) => b.average - a.average);

    res.json({ buckets: buckets.map((b) => ({ label: b.label, count: b.count })), subjects, total: marks.length });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Students flagged for low attendance and/or low average marks.
export async function atRisk(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId!;
    const { att, mk } = await studentMetrics(orgId);

    const students = await prisma.student.findMany({
      where: { org_id: orgId, is_active: true },
      select: { id: true, first_name: true, last_name: true, roll_number: true, class: { select: { name: true, section: true } } },
    });

    const flagged = [];
    for (const s of students) {
      const a = att.get(s.id);
      const m = mk.get(s.id);
      const attendancePct = a && a.total >= MIN_ATTENDANCE_DAYS ? Math.round((a.attended / a.total) * 100) : null;
      const avgPct = m && m.count > 0 ? Math.round(m.sum / m.count) : null;

      const reasons: string[] = [];
      if (attendancePct !== null && attendancePct < LOW_ATTENDANCE) reasons.push(`Attendance ${attendancePct}%`);
      if (avgPct !== null && avgPct < LOW_AVERAGE) reasons.push(`Average ${avgPct}%`);
      if (reasons.length === 0) continue;

      flagged.push({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        roll_number: s.roll_number,
        class: s.class ? `${s.class.name}${s.class.section ? ` - ${s.class.section}` : ''}` : '',
        attendance: attendancePct, average: avgPct, reasons,
      });
    }

    // Worst first: lowest attendance, then lowest average.
    flagged.sort((a, b) => (a.attendance ?? 100) - (b.attendance ?? 100) || (a.average ?? 100) - (b.average ?? 100));

    res.json({ at_risk: flagged, thresholds: { attendance: LOW_ATTENDANCE, average: LOW_AVERAGE } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV export of every active student with class, attendance %, and average %.
export async function exportStudentsCsv(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId!;
    const { att, mk } = await studentMetrics(orgId);
    const students = await prisma.student.findMany({
      where: { org_id: orgId, is_active: true },
      select: { id: true, first_name: true, last_name: true, roll_number: true, class: { select: { name: true, section: true } } },
      orderBy: { roll_number: 'asc' },
    });

    const header = ['Roll Number', 'Name', 'Class', 'Attendance %', 'Average %'];
    const lines = [header.join(',')];
    for (const s of students) {
      const a = att.get(s.id);
      const m = mk.get(s.id);
      const attendancePct = a && a.total > 0 ? Math.round((a.attended / a.total) * 100) : '';
      const avgPct = m && m.count > 0 ? Math.round(m.sum / m.count) : '';
      const className = s.class ? `${s.class.name}${s.class.section ? ` - ${s.class.section}` : ''}` : '';
      lines.push([s.roll_number, `${s.first_name} ${s.last_name}`, className, attendancePct, avgPct].map(csvCell).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="students-report.csv"');
    res.send(lines.join('\n'));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
