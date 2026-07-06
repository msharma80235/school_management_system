import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface GradeRule { min: number; max: number; grade: string; remark: string; }

interface ReportData {
  student: {
    name: string; roll_number: string; date_of_birth: string;
    gender: string; parent_name: string; class_name: string; academic_year: string;
    photo_path?: string; // absolute path; only set when the photo should print
  };
  subjects: {
    subject: { name: string };
    exams: { exam_type: string; marks_obtained: number; max_marks: number }[];
    totalObtained: number; totalMax: number; percentage: number; grade: string;
  }[];
  examTypes: string[];
  summary: { totalObtained: number; totalMax: number; percentage: number; grade: string; remark: string };
  attendance?: { total: number; present: number; absent: number; percentage: number } | null;
  config: {
    institute_name: string; address_line: string; tagline: string;
    show_attendance: boolean; show_grade: boolean; show_percentage: boolean;
    show_remarks: boolean; principal_name: string; logo_path?: string;
    grading_system: GradeRule[];
  };
}

const COLORS = {
  primary: '#1e3a5f',
  secondary: '#2563eb',
  accent: '#059669',
  headerBg: '#1e3a5f',
  headerText: '#ffffff',
  tableBorder: '#cbd5e1',
  tableHeaderBg: '#e2e8f0',
  tableAltRow: '#f8fafc',
  gradeA: '#059669',
  gradeB: '#2563eb',
  gradeC: '#d97706',
  gradeD: '#dc2626',
  text: '#1e293b',
  textLight: '#64748b',
};

const TYPE_LABELS: Record<string, string> = {
  midterm_written: 'MT Written', midterm_oral: 'MT Oral',
  final_written: 'Final Written', final_oral: 'Final Oral',
  class_test: 'Class Test', project: 'Project',
};

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return COLORS.gradeA;
  if (grade.startsWith('B')) return COLORS.gradeB;
  if (grade.startsWith('C')) return COLORS.gradeC;
  return COLORS.gradeD;
}

function drawLogoBadge(doc: PDFKit.PDFDocument, cx: number, cy: number, initials: string, color: string) {
  // Everything inside save/restore so nothing leaks
  doc.save();

  // 1) Outer circle - solid fill
  doc.circle(cx, cy, 28).fill(color);

  // 2) Inner ring
  doc.circle(cx, cy, 24).lineWidth(1.5).strokeColor('#ffffff').stroke();

  // 3) Initials
  doc.fontSize(16).fillColor('#ffffff').font('Helvetica-Bold')
    .text(initials, cx - 25, cy - 8, { width: 50, align: 'center' });

  // 4) Accent line under initials
  doc.moveTo(cx - 14, cy + 10).lineTo(cx + 14, cy + 10)
    .lineWidth(1).strokeColor('#f59e0b').stroke();

  // 5) Small dots as decoration
  doc.circle(cx - 18, cy + 10, 1.2).fill('#f59e0b');
  doc.circle(cx + 18, cy + 10, 1.2).fill('#f59e0b');

  // 6) Top accent arc
  doc.save();
  const arcR = 20;
  doc.moveTo(cx - arcR * Math.cos(Math.PI / 6), cy - arcR * Math.sin(Math.PI / 6));
  doc.arc(cx, cy, arcR, -Math.PI / 6 - Math.PI / 2, Math.PI / 6 - Math.PI / 2)
    .lineWidth(1.5).strokeColor('#f59e0b').stroke();
  doc.restore();

  doc.restore();
}

export function generateReportCardPDF(data: ReportData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
  const pageWidth = 595.28 - 80; // A4 width minus margins

  // ===== HEADER WITH LOGO =====
  const headerY = 40;
  let hasLogo = false;

  // Logo - embed image if available
  if (data.config.logo_path) {
    const logoPath = path.resolve(data.config.logo_path);
    if (fs.existsSync(logoPath)) {
      const ext = path.extname(logoPath).toLowerCase();
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        try {
          doc.image(logoPath, 40, headerY, { width: 60, height: 60 });
          hasLogo = true;
        } catch {}
      }
    }
  }

  // Institute name and details
  const textStartX = hasLogo ? 110 : 40;
  doc.fontSize(20).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text(data.config.institute_name || 'Institute Name', textStartX, headerY, { width: pageWidth - (textStartX - 40), align: hasLogo ? 'left' : 'center' });

  if (data.config.address_line) {
    doc.fontSize(9).fillColor(COLORS.textLight).font('Helvetica')
      .text(data.config.address_line, textStartX, doc.y + 2, { width: pageWidth - (textStartX - 40), align: hasLogo ? 'left' : 'center' });
  }
  if (data.config.tagline) {
    doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica-Oblique')
      .text(`"${data.config.tagline}"`, textStartX, doc.y + 1, { width: pageWidth - (textStartX - 40), align: hasLogo ? 'left' : 'center' });
  }

  // Colored divider
  const dividerY = Math.max(doc.y + 10, headerY + 70);
  doc.moveTo(40, dividerY).lineTo(40 + pageWidth, dividerY).lineWidth(3).strokeColor(COLORS.secondary).stroke();
  doc.moveTo(40, dividerY + 3).lineTo(40 + pageWidth, dividerY + 3).lineWidth(1).strokeColor(COLORS.accent).stroke();

  // Report Card title
  doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text('REPORT CARD', 40, dividerY + 12, { width: pageWidth, align: 'center' });
  doc.fontSize(10).fillColor(COLORS.textLight).font('Helvetica')
    .text(`Academic Year: ${data.student.academic_year}`, 40, doc.y + 2, { width: pageWidth, align: 'center' });

  // ===== STUDENT INFO BOX =====
  const infoY = doc.y + 12;

  // Optional passport-style photo docked to the right of the info box
  let hasPhoto = false;
  if (data.student.photo_path && fs.existsSync(data.student.photo_path) &&
      ['.png', '.jpg', '.jpeg'].includes(path.extname(data.student.photo_path).toLowerCase())) {
    hasPhoto = true;
  }
  const infoBoxH = 65;
  const photoW = 48, photoH = 57;
  const photoX = 40 + pageWidth - photoW - 8;

  doc.roundedRect(40, infoY, pageWidth, infoBoxH, 5).fillColor('#f0f9ff').fill();
  doc.roundedRect(40, infoY, pageWidth, infoBoxH, 5).strokeColor(COLORS.secondary).lineWidth(0.5).stroke();

  if (hasPhoto) {
    try {
      doc.save();
      doc.roundedRect(photoX, infoY + 4, photoW, photoH, 3).clip();
      doc.image(data.student.photo_path!, photoX, infoY + 4, { width: photoW, height: photoH, cover: [photoW, photoH], align: 'center', valign: 'center' } as any);
      doc.restore();
      doc.roundedRect(photoX, infoY + 4, photoW, photoH, 3).strokeColor(COLORS.secondary).lineWidth(0.75).stroke();
    } catch {
      hasPhoto = false;
    }
  }

  // Shift the third column left a little when the photo occupies the right edge
  const col1X = 50, col2X = 220, col3X = hasPhoto ? 370 : 390;
  const row1Y = infoY + 10, row2Y = infoY + 28, row3Y = infoY + 46;

  const infoLabel = (x: number, y: number, label: string, value: string) => {
    doc.fontSize(7).fillColor(COLORS.textLight).font('Helvetica').text(label, x, y);
    doc.fontSize(9).fillColor(COLORS.text).font('Helvetica-Bold').text(value, x, y + 8);
  };

  infoLabel(col1X, row1Y, 'STUDENT NAME', data.student.name);
  infoLabel(col2X, row1Y, 'ROLL NUMBER', data.student.roll_number);
  infoLabel(col3X, row1Y, 'CLASS', data.student.class_name);
  infoLabel(col1X, row2Y, 'DATE OF BIRTH', data.student.date_of_birth);
  infoLabel(col2X, row2Y, 'GENDER', data.student.gender.charAt(0).toUpperCase() + data.student.gender.slice(1));
  infoLabel(col3X, row2Y, 'PARENT/GUARDIAN', data.student.parent_name);

  // ===== MARKS TABLE =====
  let tableY = infoY + 80;
  const examCols = data.examTypes;
  const baseColWidth = 90; // Subject column
  const examColWidth = Math.min(70, (pageWidth - baseColWidth - (data.config.show_percentage ? 40 : 0) - (data.config.show_grade ? 40 : 0) - 55) / examCols.length);
  const totalColWidth = 55;
  const pctColWidth = data.config.show_percentage ? 40 : 0;
  const gradeColWidth = data.config.show_grade ? 40 : 0;
  const rowHeight = 20;

  // Table header
  doc.rect(40, tableY, pageWidth, rowHeight + 4).fillColor(COLORS.headerBg).fill();
  let colX = 40;

  doc.fontSize(7).fillColor(COLORS.headerText).font('Helvetica-Bold');
  doc.text('SUBJECT', colX + 4, tableY + 6, { width: baseColWidth - 8 });
  colX += baseColWidth;

  for (const et of examCols) {
    doc.text(TYPE_LABELS[et] || et, colX + 2, tableY + 4, { width: examColWidth - 4, align: 'center' });
    colX += examColWidth;
  }

  doc.text('TOTAL', colX + 2, tableY + 6, { width: totalColWidth - 4, align: 'center' });
  colX += totalColWidth;
  if (data.config.show_percentage) {
    doc.text('%', colX + 2, tableY + 6, { width: pctColWidth - 4, align: 'center' });
    colX += pctColWidth;
  }
  if (data.config.show_grade) {
    doc.text('GRADE', colX + 2, tableY + 6, { width: gradeColWidth - 4, align: 'center' });
  }

  tableY += rowHeight + 4;

  // Table rows
  data.subjects.forEach((sub, idx) => {
    const bgColor = idx % 2 === 0 ? '#ffffff' : COLORS.tableAltRow;
    doc.rect(40, tableY, pageWidth, rowHeight).fillColor(bgColor).fill();

    colX = 40;
    doc.fontSize(8).fillColor(COLORS.text).font('Helvetica-Bold');
    doc.text(sub.subject.name, colX + 4, tableY + 6, { width: baseColWidth - 8 });
    colX += baseColWidth;

    doc.font('Helvetica').fontSize(8);
    for (const et of examCols) {
      const exam = sub.exams.find((e) => e.exam_type === et);
      const val = exam ? `${exam.marks_obtained}/${exam.max_marks}` : '-';
      doc.fillColor(COLORS.text).text(val, colX + 2, tableY + 6, { width: examColWidth - 4, align: 'center' });
      colX += examColWidth;
    }

    doc.font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(`${sub.totalObtained}/${sub.totalMax}`, colX + 2, tableY + 6, { width: totalColWidth - 4, align: 'center' });
    colX += totalColWidth;

    if (data.config.show_percentage) {
      doc.fillColor(COLORS.text).text(`${sub.percentage}%`, colX + 2, tableY + 6, { width: pctColWidth - 4, align: 'center' });
      colX += pctColWidth;
    }

    if (data.config.show_grade) {
      doc.fillColor(gradeColor(sub.grade)).font('Helvetica-Bold')
        .text(sub.grade, colX + 2, tableY + 6, { width: gradeColWidth - 4, align: 'center' });
    }

    // Row border
    doc.rect(40, tableY, pageWidth, rowHeight).strokeColor(COLORS.tableBorder).lineWidth(0.3).stroke();
    tableY += rowHeight;
  });

  // Grand total row
  doc.rect(40, tableY, pageWidth, rowHeight + 2).fillColor(COLORS.headerBg).fill();
  colX = 40;
  doc.fontSize(8).fillColor(COLORS.headerText).font('Helvetica-Bold');
  doc.text('GRAND TOTAL', colX + 4, tableY + 7, { width: baseColWidth + examCols.length * examColWidth - 8 });
  colX = 40 + baseColWidth + examCols.length * examColWidth;
  doc.text(`${data.summary.totalObtained}/${data.summary.totalMax}`, colX + 2, tableY + 7, { width: totalColWidth - 4, align: 'center' });
  colX += totalColWidth;
  if (data.config.show_percentage) {
    doc.text(`${data.summary.percentage}%`, colX + 2, tableY + 7, { width: pctColWidth - 4, align: 'center' });
    colX += pctColWidth;
  }
  if (data.config.show_grade) {
    doc.text(data.summary.grade, colX + 2, tableY + 7, { width: gradeColWidth - 4, align: 'center' });
  }
  tableY += rowHeight + 8;

  // ===== RESULT BOX =====
  const resultBoxWidth = 200;
  const resultBoxX = 40 + (pageWidth - resultBoxWidth) / 2;
  doc.roundedRect(resultBoxX, tableY, resultBoxWidth, 55, 5)
    .fillColor('#ecfdf5').fill();
  doc.roundedRect(resultBoxX, tableY, resultBoxWidth, 55, 5)
    .strokeColor(COLORS.accent).lineWidth(1).stroke();

  doc.fontSize(9).fillColor(COLORS.textLight).font('Helvetica')
    .text('OVERALL RESULT', resultBoxX, tableY + 6, { width: resultBoxWidth, align: 'center' });
  doc.fontSize(28).fillColor(gradeColor(data.summary.grade)).font('Helvetica-Bold')
    .text(data.summary.grade, resultBoxX, tableY + 16, { width: resultBoxWidth, align: 'center' });
  doc.fontSize(9).fillColor(COLORS.text).font('Helvetica')
    .text(`${data.summary.percentage}% - ${data.summary.remark}`, resultBoxX, tableY + 42, { width: resultBoxWidth, align: 'center' });

  tableY += 65;

  // ===== ATTENDANCE =====
  if (data.config.show_attendance && data.attendance && data.attendance.total > 0) {
    doc.fontSize(9).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text('ATTENDANCE SUMMARY', 40, tableY);
    tableY += 14;

    const attItems = [
      { label: 'Total Days', value: String(data.attendance.total), color: COLORS.text },
      { label: 'Present', value: String(data.attendance.present), color: COLORS.gradeA },
      { label: 'Absent', value: String(data.attendance.absent), color: COLORS.gradeD },
      { label: 'Attendance', value: `${data.attendance.percentage}%`, color: COLORS.secondary },
    ];

    const attBoxWidth = pageWidth / 4;
    attItems.forEach((item, i) => {
      const x = 40 + i * attBoxWidth;
      doc.roundedRect(x + 2, tableY, attBoxWidth - 4, 30, 3).fillColor('#f8fafc').fill();
      doc.fontSize(12).fillColor(item.color).font('Helvetica-Bold')
        .text(item.value, x + 2, tableY + 4, { width: attBoxWidth - 4, align: 'center' });
      doc.fontSize(7).fillColor(COLORS.textLight).font('Helvetica')
        .text(item.label, x + 2, tableY + 19, { width: attBoxWidth - 4, align: 'center' });
    });
    tableY += 40;
  }

  // ===== GRADING SCALE =====
  doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text('GRADING SCALE', 40, tableY + 5);
  tableY += 16;
  const gradeBoxW = pageWidth / data.config.grading_system.length;
  data.config.grading_system.forEach((g: GradeRule, i: number) => {
    const x = 40 + i * gradeBoxW;
    doc.fontSize(8).fillColor(gradeColor(g.grade)).font('Helvetica-Bold')
      .text(g.grade, x, tableY, { width: gradeBoxW, align: 'center' });
    doc.fontSize(6).fillColor(COLORS.textLight).font('Helvetica')
      .text(`${g.min}-${g.max}%`, x, tableY + 10, { width: gradeBoxW, align: 'center' });
  });
  tableY += 25;

  // ===== SIGNATURES =====
  const sigY = Math.max(tableY + 30, 720);
  const sigWidth = pageWidth / 3;

  [
    { label: 'Class Teacher', x: 40 },
    { label: data.config.principal_name || 'Principal', x: 40 + sigWidth },
    { label: 'Parent/Guardian', x: 40 + sigWidth * 2 },
  ].forEach((sig) => {
    doc.moveTo(sig.x + 15, sigY).lineTo(sig.x + sigWidth - 15, sigY)
      .strokeColor(COLORS.text).lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(COLORS.textLight).font('Helvetica')
      .text(sig.label, sig.x, sigY + 4, { width: sigWidth, align: 'center' });
  });

  return doc;
}
