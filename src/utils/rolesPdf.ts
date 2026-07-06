import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export interface RolesSection {
  heading: string;
  note?: string;
  duties: string[];
}

export const DEFAULT_ROLES_SECTIONS: RolesSection[] = [
  {
    heading: 'Class Teacher',
    note: 'Teachers can access only the classes assigned to them by the admin.',
    duties: [
      'Maintain daily student attendance for the assigned class',
      'Create exams (mid-term written/oral, final written/oral, class tests, projects) and enter marks on time',
      'Submit entered marks to the admin for approval; correct and resubmit promptly if rejected',
      'Assign homework with clear instructions, referencing the class book where applicable',
      'Generate and review student report cards once marks are approved',
      'Maintain the class book list and keep parents informed through the proper channels',
    ],
  },
  {
    heading: 'Co-Teacher',
    duties: [
      'A class may have multiple teachers — including two teachers for the same subject',
      'Every co-teacher shares full class-teacher duties: attendance, marks, homework, report cards',
      'Co-teachers coordinate among themselves to split responsibilities (e.g., one enters marks, the other maintains attendance)',
      'System access is identical for all teachers assigned to the class',
    ],
  },
  {
    heading: 'Administrative Staff',
    note: 'Duties are customizable per person and assigned by the admin. Staff have no access to academic records.',
    duties: [
      'Class Support — assist the class teacher of the assigned class with materials, supervision, and escorting students',
      'Laboratory — set up and maintain lab equipment, ensure safety procedures, manage inventory',
      'Office Work — front desk, admissions paperwork, records management, correspondence',
      'Custom duties as assigned — e.g., Library desk, Transport/bus duty, Canteen, Security, Examination cell',
      'Check the My Duties dashboard regularly; duty details and shifts are noted on each assignment',
    ],
  },
  {
    heading: 'Volunteer',
    duties: [
      'Mark daily student attendance for any class as directed',
      'Support teachers during school events and activities',
      'Attend monthly staff & volunteer coordination meetings',
      'Volunteers may view marksheets and homework but may not modify any records',
      'Volunteer attendance is recorded by teachers/admin; contact the office for corrections',
    ],
  },
  {
    heading: 'Admin (Principal / Administrator)',
    duties: [
      'Manage all accounts: teachers, staff, volunteers, parents, and student logins',
      'Assign teachers and co-teachers to classes; assign customizable duties to administrative staff',
      'Review and approve or reject marks submitted by teachers before report cards are issued',
      'Publish school documents and maintain the holiday calendar',
      'Configure grade levels, subjects, classes, and the report card format',
    ],
  },
];

const NAVY = '#1e3a5f', BLUE = '#2563eb', TEXT = '#334155', LIGHT = '#64748b';

export function generateRolesPdf(fileName: string, orgName: string, title: string, sections: RolesSection[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    const stream = fs.createWriteStream(path.resolve('uploads', fileName));
    doc.pipe(stream);

    // Header
    doc.rect(0, 0, 595, 100).fill(NAVY);
    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold').text(orgName, 60, 28);
    doc.fontSize(13).fillColor('#93c5fd').font('Helvetica').text(title, 60, 58, { width: 475 });
    doc.y = 120;

    sections.forEach((s, idx) => {
      if (doc.y > 640) doc.addPage();
      doc.moveDown(0.8);
      doc.fontSize(14).fillColor(NAVY).font('Helvetica-Bold').text(`${idx + 1}. ${s.heading}`);
      doc.moveTo(60, doc.y + 2).lineTo(535, doc.y + 2).lineWidth(1).strokeColor(BLUE).stroke();
      doc.moveDown(0.4);
      if (s.note) {
        doc.fontSize(9).fillColor(LIGHT).font('Helvetica-Oblique').text(s.note, { width: 475 });
        doc.moveDown(0.3);
      }
      doc.fontSize(10.5).fillColor(TEXT).font('Helvetica');
      for (const d of s.duties) {
        if (doc.y > 750) doc.addPage();
        doc.text('•  ' + d, { width: 465, indent: 8 });
        doc.moveDown(0.2);
      }
    });

    doc.moveDown(1.5);
    doc.fontSize(8.5).fillColor(LIGHT).font('Helvetica-Oblique')
      .text('Issued by the school administration. This document is also available under Documents in your portal.', { width: 475, align: 'center' });

    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}
