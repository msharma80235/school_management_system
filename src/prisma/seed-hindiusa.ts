import dotenv from 'dotenv';
dotenv.config();

import prisma from './client';
import { hashPassword } from '../utils/password';

const PASSWORD = 'Password@123';

async function seed() {
  const existing = await prisma.organization.findUnique({ where: { slug: 'hindiusa' } });
  if (existing) {
    console.log('HindiUSA already exists — delete it first or skip. Aborting.');
    return;
  }

  const hashed = await hashPassword(PASSWORD);

  // ===== Organization =====
  const org = await prisma.organization.create({
    data: {
      name: 'HindiUSA',
      slug: 'hindiusa',
      email: 'info@hindiusa.org',
      phone: '7326667700',
      address: '66 Community Lane, Edison, NJ 08820',
    },
  });
  console.log('Org: HindiUSA (slug: hindiusa)');

  // ===== Admin =====
  const admin = await prisma.user.create({
    data: { name: 'Devendra Singh', email: 'admin@hindiusa.org', password: hashed, role: 'admin', org_id: org.id },
  });
  console.log('Admin: admin@hindiusa.org');

  // ===== Teachers =====
  const teacherDefs = [
    { name: 'Anjali Sharma', email: 'anjali@hindiusa.org', subject: 'Hindi Reading' },
    { name: 'Rekha Patel', email: 'rekha@hindiusa.org', subject: 'Hindi Writing' },
    { name: 'Suresh Iyer', email: 'suresh@hindiusa.org', subject: 'Hindi Speaking' },
    { name: 'Kavita Joshi', email: 'kavita@hindiusa.org', subject: 'Indian Culture' },
  ];
  const teachers: any[] = [];
  for (const t of teacherDefs) {
    teachers.push(await prisma.user.create({
      data: { name: t.name, email: t.email, password: hashed, role: 'teacher', subject: t.subject, org_id: org.id },
    }));
    console.log('Teacher:', t.email);
  }

  // ===== Custom grade levels (language-school style) =====
  const grades = ['Prarambh', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Praveen'];
  for (let i = 0; i < grades.length; i++) {
    await prisma.gradeLevel.create({ data: { name: grades[i], display_order: i, org_id: org.id } });
  }
  console.log('Grade levels:', grades.join(', '));

  // ===== Classes (Level 3 gets CO-TEACHERS: Suresh + Kavita) =====
  const classDefs = [
    { name: 'Prarambh', section: '', teacherIdxs: [0] },
    { name: 'Level 1', section: 'A', teacherIdxs: [1] },
    { name: 'Level 3', section: '', teacherIdxs: [2, 3] },
  ];
  const classes: any[] = [];
  for (const c of classDefs) {
    const cls = await prisma.class.create({
      data: { name: c.name, section: c.section, academic_year: '2026-2027', org_id: org.id },
    });
    for (const idx of c.teacherIdxs) {
      await prisma.classTeacher.create({ data: { class_id: cls.id, teacher_id: teachers[idx].id } });
    }
    classes.push({ ...cls, teacher_id: teachers[c.teacherIdxs[0]].id });
  }
  console.log(`Classes: ${classes.length} (Level 3 has co-teachers Suresh + Kavita)`);

  // ===== Subjects =====
  const subjectDefs = [
    { name: 'Hindi Reading', code: 'HR' },
    { name: 'Hindi Writing', code: 'HW' },
    { name: 'Hindi Speaking', code: 'HS' },
    { name: 'Indian Culture', code: 'IC' },
  ];
  const subjects: any[] = [];
  for (const s of subjectDefs) {
    subjects.push(await prisma.subject.create({ data: { name: s.name, code: s.code, org_id: org.id } }));
  }
  for (const cls of classes) {
    for (const sub of subjects) {
      await prisma.classSubject.create({ data: { class_id: cls.id, subject_id: sub.id } });
    }
  }
  console.log('Subjects:', subjectDefs.map((s) => s.name).join(', '));

  // ===== Students (8 per class) =====
  const firstNames = ['Aanya', 'Ishan', 'Diya', 'Arnav', 'Sara', 'Vivaan', 'Anika', 'Rohan',
    'Meera', 'Kabir', 'Priya', 'Dev', 'Riya', 'Aditya', 'Tara', 'Yash',
    'Naina', 'Arjun', 'Simran', 'Krish', 'Pooja', 'Nikhil', 'Asha', 'Varun'];
  const lastNames = ['Agarwal', 'Bhatt', 'Chopra', 'Desai', 'Gandhi', 'Kapoor', 'Mehta', 'Nair'];

  const students: any[] = [];
  let roll = 1;
  for (const cls of classes) {
    for (let i = 0; i < 8; i++) {
      const fn = firstNames[(roll - 1) % firstNames.length];
      const ln = lastNames[(roll - 1) % lastNames.length];
      const s = await prisma.student.create({
        data: {
          first_name: fn, last_name: ln,
          roll_number: `HU-${String(roll).padStart(3, '0')}`,
          date_of_birth: `20${14 + (roll % 4)}-0${1 + (roll % 9)}-1${roll % 9}`,
          gender: roll % 2 === 0 ? 'female' : 'male',
          class_id: cls.id,
          parent_name: `Parent of ${fn}`, parent_phone: `90${String(10000000 + roll * 137).slice(0, 8)}`,
          address: `${roll * 3} Maple Street, Edison, NJ`,
          entered_by: admin.id, org_id: org.id,
        },
      });
      students.push(s);
      roll++;
    }
  }
  console.log(`Students: ${students.length}`);

  // Student logins (first 4)
  for (let i = 0; i < 4; i++) {
    const s = students[i];
    const email = `${s.first_name.toLowerCase()}@student.hindiusa.org`;
    const u = await prisma.user.create({
      data: { name: `${s.first_name} ${s.last_name}`, email, password: hashed, role: 'student', org_id: org.id },
    });
    await prisma.student.update({ where: { id: s.id }, data: { user_id: u.id } });
    console.log('Student login:', email, `(${s.roll_number})`);
  }

  // ===== Parents (4, linked) =====
  for (let i = 0; i < 4; i++) {
    const s = students[i * 2];
    const email = `parent${i + 1}@hindiusa.org`;
    const p = await prisma.user.create({
      data: { name: `${s.last_name} Family`, email, password: hashed, role: 'parent', org_id: org.id },
    });
    await prisma.parentStudent.create({ data: { parent_id: p.id, student_id: s.id } });
  }
  console.log('Parents: 4 (parent1..parent4@hindiusa.org)');

  // ===== Volunteer + Staff =====
  await prisma.user.create({
    data: { name: 'Neha Verma', email: 'volunteer@hindiusa.org', password: hashed, role: 'volunteer', org_id: org.id },
  });
  const staff = await prisma.user.create({
    data: { name: 'Mohan Rao', email: 'staff@hindiusa.org', password: hashed, role: 'staff', org_id: org.id },
  });
  await prisma.staffAssignment.create({
    data: { staff_id: staff.id, assignment_type: 'office', details: 'Weekend registration desk', org_id: org.id },
  });
  await prisma.staffAssignment.create({
    data: { staff_id: staff.id, assignment_type: 'cultural events', details: 'Coordinate Diwali and Holi celebration logistics', org_id: org.id },
  });
  console.log('Volunteer: volunteer@hindiusa.org | Staff: staff@hindiusa.org (office + cultural events)');

  // ===== Exams + marks (approved so report cards work) =====
  const examTypes = [
    { type: 'midterm_written', term: 'term1', max: 50, name: 'Mid-Term Written' },
    { type: 'midterm_oral', term: 'term1', max: 25, name: 'Mid-Term Oral' },
    { type: 'project', term: 'term1', max: 25, name: 'Term 1 Project' },
    { type: 'final_written', term: 'term2', max: 50, name: 'Final Written' },
    { type: 'final_oral', term: 'term2', max: 25, name: 'Final Oral' },
  ];
  let examCount = 0, markCount = 0;
  for (const cls of classes) {
    const classStudents = students.filter((s) => s.class_id === cls.id);
    for (const sub of subjects) {
      for (const et of examTypes) {
        const exam = await prisma.exam.create({
          data: {
            name: `${et.name} - ${sub.name}`, exam_type: et.type, term: et.term,
            class_id: cls.id, subject_id: sub.id, max_marks: et.max,
            approval_status: 'approved', approved_at: new Date(), org_id: org.id,
          },
        });
        examCount++;
        for (const st of classStudents) {
          const pct = 0.45 + ((st.roll_number.charCodeAt(4) + examCount) % 50) / 100;
          await prisma.mark.create({
            data: {
              student_id: st.id, exam_id: exam.id,
              marks_obtained: Math.min(Math.round(pct * et.max * 2) / 2, et.max),
              entered_by: cls.teacher_id, org_id: org.id,
            },
          });
          markCount++;
        }
      }
    }
  }
  console.log(`Exams: ${examCount} (approved) | Marks: ${markCount}`);

  // ===== Attendance (July 2026 weekends — HindiUSA runs weekend classes) =====
  let attCount = 0;
  for (const cls of classes) {
    const classStudents = students.filter((s) => s.class_id === cls.id);
    for (let d = 1; d <= 31; d++) {
      const date = new Date(2026, 6, d); // July 2026
      if (date.getDay() !== 6) continue; // Saturdays only
      const dateStr = `2026-07-${String(d).padStart(2, '0')}`;
      for (const st of classStudents) {
        const status = (st.roll_number.charCodeAt(4) + d) % 10 < 8 ? 'present' : 'absent';
        await prisma.attendance.create({
          data: { student_id: st.id, class_id: cls.id, date: dateStr, status, marked_by: cls.teacher_id, org_id: org.id },
        });
        attCount++;
      }
    }
  }
  console.log(`Attendance: ${attCount} records (Saturday classes, July 2026)`);

  // ===== Books + homework =====
  const book1 = await prisma.book.create({
    data: { title: 'Hindi Pathmala — Book 1', author: 'HindiUSA Curriculum Team', subject_id: subjects[0].id, publisher: 'HindiUSA Press', is_mandatory: true, org_id: org.id },
  });
  await prisma.book.create({
    data: { title: 'Sulekh Abhyas (Handwriting Practice)', author: 'HindiUSA Curriculum Team', subject_id: subjects[1].id, publisher: 'HindiUSA Press', is_mandatory: true, org_id: org.id },
  });
  await prisma.book.create({
    data: { title: 'Stories of India', author: 'Kavita Joshi', custom_category: 'Cultural Reading', is_mandatory: false, org_id: org.id },
  });
  await prisma.homework.create({
    data: {
      title: 'Read lesson 4 aloud', description: 'Practice reading lesson 4 aloud twice; parents please sign the practice log',
      class_id: classes[0].id, subject_id: subjects[0].id, book_id: book1.id,
      due_date: '2026-07-11', assigned_by: teachers[0].id, org_id: org.id,
    },
  });
  await prisma.homework.create({
    data: {
      title: 'Write 10 sentences about your family', description: 'Use the vocabulary from class in Devanagari script',
      class_id: classes[1].id, subject_id: subjects[1].id,
      due_date: '2026-07-11', assigned_by: teachers[1].id, org_id: org.id,
    },
  });
  console.log('Books: 3 (incl. custom category) | Homework: 2 (one references a book)');

  // ===== Holidays =====
  const holidays = [
    { title: 'US Independence Day', date: '2026-07-04', description: 'No classes' },
    { title: 'India Independence Day Celebration', date: '2026-08-15', description: 'Special cultural program' },
    { title: 'Diwali Break', date: '2026-11-07', end_date: '2026-11-08', description: 'Happy Diwali!' },
    { title: 'Thanksgiving Weekend', date: '2026-11-26', end_date: '2026-11-28' },
    { title: 'Winter Break', date: '2026-12-19', end_date: '2027-01-03' },
  ];
  for (const h of holidays) {
    await prisma.holiday.create({ data: { ...h, created_by: admin.id, org_id: org.id } });
  }
  console.log(`Holidays: ${holidays.length}`);

  // ===== Report card config with logo =====
  await prisma.reportCardConfig.create({
    data: {
      org_id: org.id,
      institute_name: 'HindiUSA',
      institute_logo: 'logo-hindiusa.png',
      address_line: '66 Community Lane, Edison, NJ 08820',
      tagline: 'Preserving Language, Culture & Heritage',
      principal_name: 'Devendra Singh',
      show_attendance: true, show_grade: true, show_percentage: true, show_remarks: true,
    },
  });
  console.log('Report card config set with HindiUSA logo');

  console.log('\nHindiUSA seeded. All passwords:', PASSWORD);
}

seed()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
