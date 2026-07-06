import dotenv from 'dotenv';
dotenv.config();

import prisma from './client';
import { hashPassword } from '../utils/password';

const PASSWORD = 'Password@123';

const firstNames = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Ananya', 'Diya', 'Myra', 'Sara', 'Aanya', 'Aadhya', 'Isha', 'Riya', 'Priya', 'Kavya',
  'Rohan', 'Karan', 'Nikhil', 'Rahul', 'Amit', 'Sneha', 'Pooja', 'Neha', 'Meera', 'Tanvi',
  'Dev', 'Aryan', 'Kabir', 'Zara', 'Kiara', 'Tara', 'Navya', 'Anika', 'Samar', 'Yash',
  'Lakshmi', 'Radha', 'Sita', 'Geeta', 'Nisha', 'Mohit', 'Vikram', 'Deepak', 'Suresh', 'Rakesh',
  'Emma', 'Liam', 'Olivia', 'Noah', 'Sophia', 'James', 'Mia', 'Lucas', 'Ella', 'Mason',
];

const lastNames = [
  'Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Reddy', 'Joshi', 'Mehta', 'Verma', 'Rao',
  'Desai', 'Nair', 'Pillai', 'Iyer', 'Bhat', 'Mishra', 'Pandey', 'Agarwal', 'Kapoor', 'Malhotra',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
];

const subjects = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer Science', 'Art', 'Physical Education'];

const parentFirstNames = ['Rajesh', 'Sunil', 'Manoj', 'Sanjay', 'Pradeep', 'Ravi', 'Arun', 'Vijay', 'Ashok', 'Ramesh',
  'Sunita', 'Anita', 'Kavitha', 'Lakshmi', 'Padma', 'Meena', 'Rekha', 'Savita', 'John', 'Mary'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function phone(): string {
  return `98${Math.floor(10000000 + Math.random() * 90000000)}`;
}

function dob(minAge: number, maxAge: number): string {
  const year = 2026 - minAge - Math.floor(Math.random() * (maxAge - minAge));
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function attendanceDates(year: number, month: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // Skip weekends
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  return dates;
}

async function seed() {
  console.log('Clearing existing data...');
  await prisma.homework.deleteMany();
  await prisma.book.deleteMany();
  await prisma.volunteerAttendance.deleteMany();
  await prisma.mark.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.classSubject.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.reportCardConfig.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.parentStudent.deleteMany();
  await prisma.student.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.class.deleteMany();
  await prisma.gradeLevel.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const hashed = await hashPassword(PASSWORD);

  // ============================================================
  // ORG 1: Sunrise Academy
  // ============================================================
  console.log('\nCreating Sunrise Academy...');
  const org1 = await prisma.organization.create({
    data: {
      name: 'Sunrise Academy',
      slug: 'sunrise-academy',
      email: 'info@sunriseacademy.edu',
      phone: '9876543210',
      address: '123 Education Lane, Mumbai, Maharashtra 400001',
    },
  });

  // Admin
  const admin1 = await prisma.user.create({
    data: { name: 'Dr. Priya Sharma', email: 'admin@sunrise.edu', password: hashed, role: 'admin', org_id: org1.id },
  });
  console.log(`  Admin: admin@sunrise.edu / ${PASSWORD}`);

  // Teachers (8)
  const teacherData = [
    { name: 'Anand Verma', email: 'anand@sunrise.edu', subject: 'Mathematics' },
    { name: 'Sunita Reddy', email: 'sunita@sunrise.edu', subject: 'Science' },
    { name: 'Rakesh Kumar', email: 'rakesh@sunrise.edu', subject: 'English' },
    { name: 'Meera Patel', email: 'meera@sunrise.edu', subject: 'Hindi' },
    { name: 'Vikram Singh', email: 'vikram@sunrise.edu', subject: 'Social Studies' },
    { name: 'Kavitha Nair', email: 'kavitha@sunrise.edu', subject: 'Computer Science' },
    { name: 'Deepak Joshi', email: 'deepak@sunrise.edu', subject: 'Art' },
    { name: 'Ritu Mehta', email: 'ritu@sunrise.edu', subject: 'Physical Education' },
  ];

  const teachers1: any[] = [];
  for (const t of teacherData) {
    // Anand and Sunita double as content moderators (approve book/document uploads)
    const isModerator = t.email === 'anand@sunrise.edu' || t.email === 'sunita@sunrise.edu';
    const teacher = await prisma.user.create({
      data: { name: t.name, email: t.email, password: hashed, role: 'teacher', subject: t.subject, is_moderator: isModerator, org_id: org1.id },
    });
    teachers1.push(teacher);
    console.log(`  Teacher: ${t.email} / ${PASSWORD} (${t.subject})${isModerator ? ' [moderator]' : ''}`);
  }

  // Grade Levels
  const grades1 = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
  for (let i = 0; i < grades1.length; i++) {
    await prisma.gradeLevel.create({ data: { name: grades1[i], display_order: i, org_id: org1.id } });
  }

  // Classes (6 classes with sections)
  const classConfigs = [
    { name: 'Class 1', section: 'A', teacher: teachers1[0] },
    { name: 'Class 1', section: 'B', teacher: teachers1[1] },
    { name: 'Class 5', section: 'A', teacher: teachers1[2] },
    { name: 'Class 8', section: 'A', teacher: teachers1[3] },
    { name: 'Class 8', section: 'B', teacher: teachers1[4] },
    { name: 'Class 10', section: 'A', teacher: teachers1[5] },
  ];

  const classes1: any[] = [];
  for (const c of classConfigs) {
    const cls = await prisma.class.create({
      data: { name: c.name, section: c.section, academic_year: '2026-2027', org_id: org1.id },
    });
    await prisma.classTeacher.create({ data: { class_id: cls.id, teacher_id: c.teacher.id } });
    // keep teacher_id handy for marked_by/entered_by references below
    classes1.push({ ...cls, teacher_id: c.teacher.id });
  }
  console.log(`  Created ${classes1.length} classes`);

  // Students (10 per class = 60 students)
  const allStudents1: any[] = [];
  let rollCounter = 1;
  for (const cls of classes1) {
    for (let i = 0; i < 10; i++) {
      const fn = firstNames[(rollCounter - 1) % firstNames.length];
      const ln = lastNames[(rollCounter - 1) % lastNames.length]; // deterministic so login emails stay stable across re-seeds
      const gender = Math.random() > 0.5 ? 'male' : 'female';
      const parentFn = pick(parentFirstNames);
      const minAge = cls.name.includes('1') ? 6 : cls.name.includes('5') ? 10 : cls.name.includes('8') ? 13 : 15;

      const student = await prisma.student.create({
        data: {
          first_name: fn, last_name: ln, roll_number: `SA-${String(rollCounter).padStart(3, '0')}`,
          date_of_birth: dob(minAge, minAge + 2), gender, class_id: cls.id,
          parent_name: `${parentFn} ${ln}`, parent_phone: phone(),
          address: `${Math.floor(1 + Math.random() * 200)}, Sector ${Math.floor(1 + Math.random() * 30)}, Mumbai`,
          entered_by: admin1.id, org_id: org1.id,
        },
      });
      allStudents1.push(student);
      rollCounter++;
    }
  }
  console.log(`  Created ${allStudents1.length} students`);

  // Student login accounts (first 10 students)
  const studentAccounts: any[] = [];
  for (let i = 0; i < 10; i++) {
    const s = allStudents1[i];
    const email = `${s.first_name.toLowerCase()}.${s.last_name.toLowerCase()}@student.sunrise.edu`;
    const user = await prisma.user.create({
      data: { name: `${s.first_name} ${s.last_name}`, email, password: hashed, role: 'student', org_id: org1.id },
    });
    await prisma.student.update({ where: { id: s.id }, data: { user_id: user.id } });
    studentAccounts.push({ email, name: `${s.first_name} ${s.last_name}`, roll: s.roll_number });
  }
  console.log(`  Created ${studentAccounts.length} student login accounts`);
  console.log(`  Sample student: ${studentAccounts[0].email} / ${PASSWORD} (${studentAccounts[0].roll})`);

  // Parent accounts (20 parents, each linked to 1-3 students)
  const parentAccounts: any[] = [];
  const usedStudents = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const pfn = parentFirstNames[i % parentFirstNames.length];
    const pln = lastNames[i % lastNames.length];
    const email = `${pfn.toLowerCase()}.${pln.toLowerCase()}${i}@parent.sunrise.edu`;

    const parent = await prisma.user.create({
      data: { name: `${pfn} ${pln}`, email, password: hashed, role: 'parent', org_id: org1.id },
    });

    // Link 1-3 children
    const numChildren = 1 + Math.floor(Math.random() * 3);
    const linked: string[] = [];
    for (let c = 0; c < numChildren; c++) {
      const studentIdx = (i * 3 + c) % allStudents1.length;
      const sid = allStudents1[studentIdx].id;
      if (!usedStudents.has(`${parent.id}-${sid}`)) {
        await prisma.parentStudent.create({ data: { parent_id: parent.id, student_id: sid } }).catch(() => {});
        usedStudents.add(`${parent.id}-${sid}`);
        linked.push(allStudents1[studentIdx].roll_number);
      }
    }
    parentAccounts.push({ email, name: `${pfn} ${pln}`, children: linked });
  }
  console.log(`  Created ${parentAccounts.length} parent accounts`);
  console.log(`  Sample parent: ${parentAccounts[0].email} / ${PASSWORD}`);

  // Attendance for past 3 months (April, May, June 2026)
  console.log('  Generating attendance records...');
  let attendanceCount = 0;
  for (const cls of classes1) {
    const classStudents = allStudents1.filter((s: any) => s.class_id === cls.id);
    for (const month of [4, 5, 6]) {
      const dates = attendanceDates(2026, month);
      for (const date of dates) {
        for (const student of classStudents) {
          const rand = Math.random();
          let status: string;
          if (rand < 0.85) status = 'present';
          else if (rand < 0.93) status = 'absent';
          else status = 'late';

          await prisma.attendance.create({
            data: {
              student_id: student.id, class_id: cls.id, date, status,
              remarks: status === 'absent' ? pick(['Sick', 'Family event', 'Not informed', '']) : null,
              marked_by: cls.teacher_id, org_id: org1.id,
            },
          });
          attendanceCount++;
        }
      }
    }
  }
  console.log(`  Created ${attendanceCount} attendance records`);

  // Subjects
  console.log('  Creating subjects and exams...');
  const subjectData = [
    { name: 'Mathematics', code: 'MATH' },
    { name: 'Science', code: 'SCI' },
    { name: 'English', code: 'ENG' },
    { name: 'Hindi', code: 'HIN' },
    { name: 'Social Studies', code: 'SST' },
    { name: 'Computer Science', code: 'CS' },
    { name: 'Art & Craft', code: 'ART' },
    { name: 'Physical Education', code: 'PE' },
  ];

  const subjectsCreated: any[] = [];
  for (const s of subjectData) {
    const sub = await prisma.subject.create({ data: { name: s.name, code: s.code, org_id: org1.id } });
    subjectsCreated.push(sub);
  }
  console.log(`  Created ${subjectsCreated.length} subjects`);

  // Assign subjects to classes (first 6 subjects to all classes)
  for (const cls of classes1) {
    for (const sub of subjectsCreated.slice(0, 6)) {
      await prisma.classSubject.create({ data: { class_id: cls.id, subject_id: sub.id } });
    }
  }

  // Create exams for each class and subject
  const examTypes = [
    { type: 'midterm_written', term: 'term1', max: 80, name: 'Mid-Term Written' },
    { type: 'midterm_oral', term: 'term1', max: 20, name: 'Mid-Term Oral' },
    { type: 'class_test', term: 'term1', max: 25, name: 'Class Test 1' },
    { type: 'project', term: 'term1', max: 25, name: 'Term 1 Project' },
    { type: 'final_written', term: 'term2', max: 80, name: 'Final Written' },
    { type: 'final_oral', term: 'term2', max: 20, name: 'Final Oral' },
    { type: 'class_test', term: 'term2', max: 25, name: 'Class Test 2' },
    { type: 'project', term: 'term2', max: 25, name: 'Term 2 Project' },
  ];

  let examCount = 0;
  let marksCount = 0;
  const allExams: any[] = [];

  for (const cls of classes1) {
    const classStudents = allStudents1.filter((s: any) => s.class_id === cls.id);
    for (const sub of subjectsCreated.slice(0, 6)) {
      for (const et of examTypes) {
        const exam = await prisma.exam.create({
          data: {
            name: `${et.name} - ${sub.name}`,
            exam_type: et.type,
            term: et.term,
            class_id: cls.id,
            subject_id: sub.id,
            max_marks: et.max,
            exam_date: et.term === 'term1' ? '2026-09-15' : '2027-03-15',
            approval_status: 'approved',
            approved_at: new Date(),
            org_id: org1.id,
          },
        });
        allExams.push(exam);
        examCount++;

        // Enter marks for every student
        for (const student of classStudents) {
          // Generate realistic marks based on exam type
          let minPct = 0.35, maxPct = 1.0;
          // Some students consistently perform better
          const studentIdx = classStudents.indexOf(student);
          if (studentIdx < 3) { minPct = 0.7; maxPct = 1.0; }
          else if (studentIdx < 6) { minPct = 0.5; maxPct = 0.9; }
          else { minPct = 0.3; maxPct = 0.8; }

          const pct = minPct + Math.random() * (maxPct - minPct);
          const marks = Math.round(pct * et.max * 2) / 2; // Round to 0.5

          await prisma.mark.create({
            data: {
              student_id: student.id,
              exam_id: exam.id,
              marks_obtained: Math.min(marks, et.max),
              entered_by: cls.teacher_id,
              org_id: org1.id,
            },
          });
          marksCount++;
        }
      }
    }
  }
  console.log(`  Created ${examCount} exams and ${marksCount} marks`);

  // Report card config
  await prisma.reportCardConfig.create({
    data: {
      org_id: org1.id,
      institute_name: 'Sunrise Academy',
      address_line: '123 Education Lane, Mumbai, Maharashtra 400001',
      tagline: 'Nurturing Minds, Building Futures',
      principal_name: 'Dr. Priya Sharma',
      show_attendance: true,
      show_grade: true,
      show_percentage: true,
      show_rank: true,
      show_remarks: true,
    },
  });
  console.log('  Created report card config');

  // ============================================================
  // ORG 2: Green Valley School (smaller org)
  // ============================================================
  console.log('\nCreating Green Valley School...');
  const org2 = await prisma.organization.create({
    data: {
      name: 'Green Valley School',
      slug: 'green-valley',
      email: 'info@greenvalley.edu',
      phone: '9123456780',
      address: '45 Park Road, Bangalore, Karnataka 560001',
    },
  });

  const admin2 = await prisma.user.create({
    data: { name: 'Mr. Rajiv Kapoor', email: 'admin@greenvalley.edu', password: hashed, role: 'admin', org_id: org2.id },
  });
  console.log(`  Admin: admin@greenvalley.edu / ${PASSWORD}`);

  // Teachers (4)
  const gvTeachers = [
    { name: 'Sarah Johnson', email: 'sarah@greenvalley.edu', subject: 'Mathematics' },
    { name: 'David Miller', email: 'david@greenvalley.edu', subject: 'Science' },
    { name: 'Priya Iyer', email: 'priya@greenvalley.edu', subject: 'English' },
    { name: 'Amit Desai', email: 'amit@greenvalley.edu', subject: 'Computer Science' },
  ];

  const teachers2: any[] = [];
  for (const t of gvTeachers) {
    const teacher = await prisma.user.create({
      data: { name: t.name, email: t.email, password: hashed, role: 'teacher', subject: t.subject, org_id: org2.id },
    });
    teachers2.push(teacher);
    console.log(`  Teacher: ${t.email} / ${PASSWORD}`);
  }

  // Custom grade levels (non-traditional)
  const grades2 = ['Foundation', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Advanced'];
  for (let i = 0; i < grades2.length; i++) {
    await prisma.gradeLevel.create({ data: { name: grades2[i], display_order: i, org_id: org2.id } });
  }

  // Classes (3)
  const gvClasses = [
    { name: 'Foundation', section: '', teacher: teachers2[0] },
    { name: 'Level 1', section: 'A', teacher: teachers2[1] },
    { name: 'Level 3', section: '', teacher: teachers2[2] },
  ];

  const classes2: any[] = [];
  for (const c of gvClasses) {
    const cls = await prisma.class.create({
      data: { name: c.name, section: c.section, academic_year: '2026-2027', org_id: org2.id },
    });
    await prisma.classTeacher.create({ data: { class_id: cls.id, teacher_id: c.teacher.id } });
    classes2.push({ ...cls, teacher_id: c.teacher.id });
  }

  // Students (8 per class = 24)
  const allStudents2: any[] = [];
  let rollCounter2 = 1;
  for (const cls of classes2) {
    for (let i = 0; i < 8; i++) {
      const fn = firstNames[(rollCounter2 + 30) % firstNames.length];
      const ln = lastNames[(rollCounter2 + 10) % lastNames.length];

      const student = await prisma.student.create({
        data: {
          first_name: fn, last_name: ln, roll_number: `GV-${String(rollCounter2).padStart(3, '0')}`,
          date_of_birth: dob(6, 15), gender: Math.random() > 0.5 ? 'male' : 'female',
          class_id: cls.id, parent_name: `${pick(parentFirstNames)} ${ln}`, parent_phone: phone(),
          entered_by: admin2.id, org_id: org2.id,
        },
      });
      allStudents2.push(student);
      rollCounter2++;
    }
  }
  console.log(`  Created ${allStudents2.length} students`);

  // A few student accounts for Green Valley
  for (let i = 0; i < 5; i++) {
    const s = allStudents2[i];
    const email = `${s.first_name.toLowerCase()}@student.greenvalley.edu`;
    const user = await prisma.user.create({
      data: { name: `${s.first_name} ${s.last_name}`, email, password: hashed, role: 'student', org_id: org2.id },
    });
    await prisma.student.update({ where: { id: s.id }, data: { user_id: user.id } });
  }

  // A few parent accounts
  for (let i = 0; i < 8; i++) {
    const s = allStudents2[i];
    const pfn = pick(parentFirstNames);
    const email = `${pfn.toLowerCase()}.${s.last_name.toLowerCase()}@parent.greenvalley.edu`;
    const parent = await prisma.user.create({
      data: { name: `${pfn} ${s.last_name}`, email, password: hashed, role: 'parent', org_id: org2.id },
    });
    await prisma.parentStudent.create({ data: { parent_id: parent.id, student_id: s.id } }).catch(() => {});
  }

  // Attendance for Green Valley (June only)
  let gvAttendance = 0;
  for (const cls of classes2) {
    const classStudents = allStudents2.filter((s: any) => s.class_id === cls.id);
    const dates = attendanceDates(2026, 6);
    for (const date of dates) {
      for (const student of classStudents) {
        const rand = Math.random();
        const status = rand < 0.80 ? 'present' : rand < 0.92 ? 'absent' : 'late';
        await prisma.attendance.create({
          data: {
            student_id: student.id, class_id: cls.id, date, status,
            remarks: status === 'absent' ? pick(['Sick', 'Travel', '']) : null,
            marked_by: cls.teacher_id, org_id: org2.id,
          },
        });
        gvAttendance++;
      }
    }
  }
  console.log(`  Created ${gvAttendance} attendance records`);

  // GV Subjects and exams
  const gvSubjects = [
    { name: 'Numeracy', code: 'NUM' },
    { name: 'Literacy', code: 'LIT' },
    { name: 'Science & Nature', code: 'SN' },
    { name: 'Creative Arts', code: 'CA' },
  ];
  const gvSubsCreated: any[] = [];
  for (const s of gvSubjects) {
    const sub = await prisma.subject.create({ data: { name: s.name, code: s.code, org_id: org2.id } });
    gvSubsCreated.push(sub);
  }
  for (const cls of classes2) {
    for (const sub of gvSubsCreated) {
      await prisma.classSubject.create({ data: { class_id: cls.id, subject_id: sub.id } });
    }
  }

  let gvExamCount = 0, gvMarksCount = 0;
  for (const cls of classes2) {
    const classStudents = allStudents2.filter((s: any) => s.class_id === cls.id);
    for (const sub of gvSubsCreated) {
      for (const et of [
        { type: 'midterm_written', term: 'term1', max: 50, name: 'Assessment 1' },
        { type: 'project', term: 'term1', max: 50, name: 'Project 1' },
        { type: 'final_written', term: 'term2', max: 50, name: 'Assessment 2' },
        { type: 'project', term: 'term2', max: 50, name: 'Project 2' },
      ]) {
        const exam = await prisma.exam.create({
          data: { name: `${et.name} - ${sub.name}`, exam_type: et.type, term: et.term, class_id: cls.id, subject_id: sub.id, max_marks: et.max, approval_status: 'approved', approved_at: new Date(), org_id: org2.id },
        });
        gvExamCount++;
        for (const student of classStudents) {
          const marks = Math.round((0.4 + Math.random() * 0.6) * et.max * 2) / 2;
          await prisma.mark.create({
            data: { student_id: student.id, exam_id: exam.id, marks_obtained: Math.min(marks, et.max), entered_by: cls.teacher_id, org_id: org2.id },
          });
          gvMarksCount++;
        }
      }
    }
  }
  await prisma.reportCardConfig.create({
    data: { org_id: org2.id, institute_name: 'Green Valley School', address_line: '45 Park Road, Bangalore', tagline: 'Learning Through Discovery', principal_name: 'Mr. Rajiv Kapoor' },
  });
  console.log(`  Created ${gvExamCount} exams, ${gvMarksCount} marks, report config`);

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n========================================');
  console.log('MOCK DATA SEEDED SUCCESSFULLY');
  console.log('========================================');
  console.log(`\nAll passwords: ${PASSWORD}`);
  console.log('\n--- Sunrise Academy (slug: sunrise-academy) ---');
  console.log('  Admin:   admin@sunrise.edu');
  console.log('  Teachers: anand@sunrise.edu, sunita@sunrise.edu, rakesh@sunrise.edu, etc.');
  console.log(`  Student:  ${studentAccounts[0].email} (Roll: ${studentAccounts[0].roll})`);
  console.log(`  Parent:   ${parentAccounts[0].email}`);
  console.log(`  Classes:  ${classes1.length} | Students: ${allStudents1.length} | Attendance: ${attendanceCount} records`);
  console.log(`  Subjects: ${subjectsCreated.length} | Exams: ${examCount} | Marks: ${marksCount}`);
  console.log('  Exam types: Mid-Term Written/Oral, Final Written/Oral, Class Tests, Projects');
  console.log('  Report cards: Customized with grading, attendance, ranks');
  console.log('\n--- Green Valley School (slug: green-valley) ---');
  console.log('  Admin:    admin@greenvalley.edu');
  console.log('  Teachers: sarah@greenvalley.edu, david@greenvalley.edu, etc.');
  console.log(`  Students: ${allStudents2.length} | Custom grades: ${grades2.join(', ')}`);
  console.log(`  Subjects: ${gvSubjects.map((s) => s.name).join(', ')}`);
  console.log(`  Exams: ${gvExamCount} | Marks: ${gvMarksCount}`);
  console.log('\n========================================\n');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
