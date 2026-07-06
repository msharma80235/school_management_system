# Education Hub - Mock Login Credentials

**All passwords: `Password@123`**

## Login URLs

| Portal | URL |
|--------|-----|
| Staff (Admin/Teacher) | http://localhost:5173/login |
| Parent & Student | http://localhost:5173/parent-login |
| Register New Org | http://localhost:5173/register |
| Platform Super Admin | http://localhost:5173/super-login |

---

## Platform Super Admin

Sits above all organizations — can enable/disable any org (locks out all its users instantly), view platform-wide stats, and reset any org admin's password. No organization ID needed to log in.

| Email | Password |
|-------|----------|
| super@educationhub.com | Super@123 |

### Extra test orgs (for super admin testing, all passwords `Password@123`)
| Org | Slug | State | Contents | Admin |
|-----|------|-------|----------|-------|
| Riverside Public School | riverside-public | Enabled | 2 teachers, 1 class, 12 students | admin@riverside-public.edu |
| Little Sprouts Preschool | little-sprouts | **Disabled** (try enabling it) | 1 teacher, 8 students | admin@little-sprouts.edu |
| Tech Minds Academy | tech-minds | Enabled | brand new — admin only | admin@tech-minds.edu |

---

## Content Moderation

Admin assigns any number of **moderators** from the Users page (Users → "Make Moderator"). Books and school documents added by non-moderators stay **pending** — hidden from everyone but the uploader — until a moderator or admin approves them from the **Moderation** page. Rejections carry a note; editing a rejected item resubmits it. In Sunrise Academy, `anand@sunrise.edu` and `sunita@sunrise.edu` are moderators. To see the pending flow, add a book as `deepak@sunrise.edu` (regular teacher), then approve it as Anand.

---

## Class Schedules on the Calendar

Admin builds each class's weekly timetable under **Class Schedules** (or the "Schedule" button on a class card). The **School Calendar** then shows the schedule for a selected class: periods appear as chips on each weekday, holidays automatically suppress them ("no classes"), and clicking a date shows that day's full period list. Teachers see their assigned classes, students/parents see their own/child's class. Sample data: **Class 1-A and 1-B** have full Mon–Fri timetables (assembly, subject periods, lunch).

**Teacher schedules:** each class period can be assigned a teacher, and admin adds duties/meetings under **Teacher Schedules**. Collisions are always blocked — a teacher can't be in two classes at once, and duties can't overlap teaching periods (in either direction). A teacher's combined week (teaching + duties) shows under their **My Schedule** page and as a "Teacher schedules" option on the calendar. Sample data: **Anand** teaches all Class 1-A subject periods plus Bus Duty (Mon 07:30) and a Wed 13:00 Staff Meeting; **Sunita** teaches Class 1-B and shares the staff meeting.

---

## Org 1: Sunrise Academy

**Organization ID (slug):** `sunrise-academy`

### Admin
| Email | Password |
|-------|----------|
| admin@sunrise.edu | Password@123 |

### Teachers (8)
| Email | Password | Subject |
|-------|----------|---------|
| anand@sunrise.edu | Password@123 | Mathematics — **content moderator** |
| sunita@sunrise.edu | Password@123 | Science — **content moderator** |
| rakesh@sunrise.edu | Password@123 | English |
| meera@sunrise.edu | Password@123 | Hindi |
| vikram@sunrise.edu | Password@123 | Social Studies |
| kavitha@sunrise.edu | Password@123 | Computer Science |
| deepak@sunrise.edu | Password@123 | Art |
| ritu@sunrise.edu | Password@123 | Physical Education |

### Volunteers (2)
Can mark attendance; read-only access to marksheets and homework.
| Email | Password |
|-------|----------|
| volunteer@sunrise.edu | Password@123 |
| rohit.volunteer@sunrise.edu | Password@123 |

### Administrative Staff (2)
Assigned to class/laboratory/office/custom duties by admin; can view their duties and the school calendar.
| Email | Password |
|-------|----------|
| staff@sunrise.edu | Password@123 |
| lata.staff@sunrise.edu | Password@123 |

### Students (10 with login accounts, 60 total)
| Email | Password | Roll Number |
|-------|----------|-------------|
| aarav.wilson@student.sunrise.edu | Password@123 | SA-001 |
| vivaan.davis@student.sunrise.edu | Password@123 | SA-002 |
| aditya.moore@student.sunrise.edu | Password@123 | SA-003 |
| vihaan.jones@student.sunrise.edu | Password@123 | SA-004 |
| arjun.bhat@student.sunrise.edu | Password@123 | SA-005 |
| sai.malhotra@student.sunrise.edu | Password@123 | SA-006 |
| reyansh.bhat@student.sunrise.edu | Password@123 | SA-007 |
| ayaan.agarwal@student.sunrise.edu | Password@123 | SA-008 |
| krishna.joshi@student.sunrise.edu | Password@123 | SA-009 |
| ishaan.jones@student.sunrise.edu | Password@123 | SA-010 |

### Parents (22 accounts)
Parent names are hyperlinks in the admin's student and parent tables — click one to open the parent's detail page (account status, contact, all linked children). Students can have **multiple linked parents**; both show in the student row:
- Aarav Wilson has two parents: rajesh.sharma0 + **anita.wilson**@parent.sunrise.edu
- Vivaan Davis has two parents: rajesh.sharma0 + **suresh.davis**@parent.sunrise.edu

**Student photos on marksheets:** upload an optional photo per student (All Students → "Photo"); it prints in the report card's student info box (view + PDF). Toggle "Student Photo" in report card Customize to hide photos org-wide. Sample: **Aarav Wilson** has a photo.

Parents with **no active enrolled student** are greyed out everywhere with a "No active enrolled student" tag:
- **ramesh.verma**@parent.sunrise.edu — no student linked at all
- **temp.parent**@parent.sunrise.edu — their only child was unenrolled

| Email | Password |
|-------|----------|
| rajesh.sharma0@parent.sunrise.edu | Password@123 |
| anita.wilson@parent.sunrise.edu | Password@123 |
| suresh.davis@parent.sunrise.edu | Password@123 |
| sunil.patel1@parent.sunrise.edu | Password@123 |
| manoj.singh2@parent.sunrise.edu | Password@123 |
| sanjay.kumar3@parent.sunrise.edu | Password@123 |
| pradeep.gupta4@parent.sunrise.edu | Password@123 |
| ravi.reddy5@parent.sunrise.edu | Password@123 |
| arun.joshi6@parent.sunrise.edu | Password@123 |
| vijay.mehta7@parent.sunrise.edu | Password@123 |
| ashok.verma8@parent.sunrise.edu | Password@123 |
| ramesh.rao9@parent.sunrise.edu | Password@123 |
| sunita.desai10@parent.sunrise.edu | Password@123 |
| anita.nair11@parent.sunrise.edu | Password@123 |
| kavitha.pillai12@parent.sunrise.edu | Password@123 |
| lakshmi.iyer13@parent.sunrise.edu | Password@123 |
| padma.bhat14@parent.sunrise.edu | Password@123 |
| meena.mishra15@parent.sunrise.edu | Password@123 |
| rekha.pandey16@parent.sunrise.edu | Password@123 |
| savita.agarwal17@parent.sunrise.edu | Password@123 |
| john.kapoor18@parent.sunrise.edu | Password@123 |
| mary.malhotra19@parent.sunrise.edu | Password@123 |

### Data Summary
- 6 classes: Class 1-A, Class 1-B, Class 5-A, Class 8-A, Class 8-B, Class 10-A
- 60 students (10 per class)
- 13 grade levels (Nursery to Class 10)
- 8 subjects: Mathematics, Science, English, Hindi, Social Studies, Computer Science, Art & Craft, PE
- 288 exams (Mid-Term Written/Oral, Final Written/Oral, Class Tests, Projects per subject per class)
- 2,880 marks entered across all exams
- 3,900 attendance records (April, May, June 2026)
- Report card config with custom grading, institute name, tagline, principal

---

## Org 2: Green Valley School

**Organization ID (slug):** `green-valley`

### Admin
| Email | Password |
|-------|----------|
| admin@greenvalley.edu | Password@123 |

### Teachers (4)
| Email | Password | Subject |
|-------|----------|---------|
| sarah@greenvalley.edu | Password@123 | Mathematics |
| david@greenvalley.edu | Password@123 | Science |
| priya@greenvalley.edu | Password@123 | English |
| amit@greenvalley.edu | Password@123 | Computer Science |

### Volunteers (1)
| Email | Password |
|-------|----------|
| volunteer@greenvalley.edu | Password@123 |

### Students (5 with login accounts, 24 total)
Login via Parent & Student Portal with slug `green-valley`.
Student emails follow the pattern: `firstname@student.greenvalley.edu`

### Data Summary
- 3 classes: Foundation, Level 1-A, Level 3
- 24 students (8 per class)
- 7 custom grade levels: Foundation, Level 1-5, Advanced
- 4 custom subjects: Numeracy, Literacy, Science & Nature, Creative Arts
- 48 exams, 384 marks
- 528 attendance records (June 2026)
- 8 parent accounts
- Report card config with custom settings

---

## Invite-Only Registration

Self-registration is disabled — teachers, students, parents, volunteers, and admin staff can only join via an admin invitation:

1. Admin: **Invitations** page → **New Invitation** → pick role (+ subject for teachers, student link for student/parent invites, optional name/email lock)
2. Share the generated link (`/join/CODE`) or the 8-character code
3. Invitee opens the link (or enters the code at `/join`), sets name/email/password, and is signed in automatically
4. Invites expire after 7 days, are single-use, and can be revoked by the admin

Organization registration (`/register`) still creates a new school with its own admin.

---

## Re-seeding Data

To reset and re-seed all mock data:
```bash
npm run seed:mock
```

To seed only the basic admin account:
```bash
npm run seed
```
