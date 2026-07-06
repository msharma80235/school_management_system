# Education Hub - Institute Management System

## Project Overview

A web-based application for managing an educational institute's class-level details including students, marks, exam scores (written & oral), yearly projects, report card generation, class books, and multi-role user management (Admin & Teachers).

---

## Tech Stack

| Layer        | Technology                  |
| ------------ | --------------------------- |
| Frontend     | React 18 + TypeScript       |
| Styling      | Tailwind CSS                |
| Backend      | Node.js + Express           |
| Database     | PostgreSQL                  |
| ORM          | Prisma                      |
| Auth         | JWT + bcrypt                |
| Testing      | Jest + React Testing Library |
| API Testing  | Supertest                   |

---

## Database Schema

### Users Table
| Column       | Type         | Constraints                    |
| ------------ | ------------ | ------------------------------ |
| id           | UUID         | PK, auto-generated             |
| name         | VARCHAR(100) | NOT NULL                       |
| email        | VARCHAR(150) | UNIQUE, NOT NULL               |
| password     | VARCHAR(255) | NOT NULL (hashed)              |
| role         | ENUM         | 'admin' or 'teacher'           |
| subject      | VARCHAR(100) | nullable (for teachers)        |
| is_active    | BOOLEAN      | DEFAULT true                   |
| created_at   | TIMESTAMP    | DEFAULT now()                  |
| updated_at   | TIMESTAMP    | auto-update                    |

### Classes Table
| Column       | Type         | Constraints                    |
| ------------ | ------------ | ------------------------------ |
| id           | UUID         | PK, auto-generated             |
| name         | VARCHAR(50)  | NOT NULL (e.g., "Class 5-A")   |
| section      | VARCHAR(10)  | NOT NULL                       |
| academic_year| VARCHAR(9)   | NOT NULL (e.g., "2026-2027")   |
| teacher_id   | UUID         | FK -> Users(id)                |
| created_at   | TIMESTAMP    | DEFAULT now()                  |

### Students Table
| Column       | Type         | Constraints                    |
| ------------ | ------------ | ------------------------------ |
| id           | UUID         | PK, auto-generated             |
| first_name   | VARCHAR(50)  | NOT NULL                       |
| last_name    | VARCHAR(50)  | NOT NULL                       |
| roll_number  | VARCHAR(20)  | UNIQUE, NOT NULL               |
| date_of_birth| DATE         | NOT NULL                       |
| gender       | ENUM         | 'male', 'female', 'other'     |
| class_id     | UUID         | FK -> Classes(id)              |
| parent_name  | VARCHAR(100) | NOT NULL                       |
| parent_phone | VARCHAR(15)  | NOT NULL                       |
| address      | TEXT         | nullable                       |
| created_at   | TIMESTAMP    | DEFAULT now()                  |

### Subjects Table
| Column       | Type         | Constraints                    |
| ------------ | ------------ | ------------------------------ |
| id           | UUID         | PK, auto-generated             |
| name         | VARCHAR(100) | NOT NULL                       |
| code         | VARCHAR(10)  | UNIQUE, NOT NULL               |
| class_id     | UUID         | FK -> Classes(id)              |
| teacher_id   | UUID         | FK -> Users(id)                |

### Exams Table
| Column       | Type         | Constraints                    |
| ------------ | ------------ | ------------------------------ |
| id           | UUID         | PK, auto-generated             |
| name         | VARCHAR(100) | NOT NULL (e.g., "Mid-Term")    |
| type         | ENUM         | 'written' or 'oral'            |
| term         | ENUM         | 'term1', 'term2', 'term3'      |
| class_id     | UUID         | FK -> Classes(id)              |
| subject_id   | UUID         | FK -> Subjects(id)             |
| max_marks    | INTEGER      | NOT NULL                       |
| exam_date    | DATE         | NOT NULL                       |
| created_at   | TIMESTAMP    | DEFAULT now()                  |

### Marks Table
| Column       | Type         | Constraints                    |
| ------------ | ------------ | ------------------------------ |
| id           | UUID         | PK, auto-generated             |
| student_id   | UUID         | FK -> Students(id)             |
| exam_id      | UUID         | FK -> Exams(id)                |
| marks_obtained| DECIMAL(5,2)| NOT NULL                       |
| remarks      | TEXT         | nullable                       |
| entered_by   | UUID         | FK -> Users(id)                |
| created_at   | TIMESTAMP    | DEFAULT now()                  |
| UNIQUE       |              | (student_id, exam_id)          |

### Projects Table
| Column       | Type         | Constraints                    |
| ------------ | ------------ | ------------------------------ |
| id           | UUID         | PK, auto-generated             |
| title        | VARCHAR(200) | NOT NULL                       |
| description  | TEXT         | nullable                       |
| subject_id   | UUID         | FK -> Subjects(id)             |
| class_id     | UUID         | FK -> Classes(id)              |
| max_marks    | INTEGER      | NOT NULL                       |
| due_date     | DATE         | NOT NULL                       |
| term         | ENUM         | 'term1', 'term2', 'term3'      |
| created_at   | TIMESTAMP    | DEFAULT now()                  |

### Project Scores Table
| Column       | Type         | Constraints                    |
| ------------ | ------------ | ------------------------------ |
| id           | UUID         | PK, auto-generated             |
| project_id   | UUID         | FK -> Projects(id)             |
| student_id   | UUID         | FK -> Students(id)             |
| marks_obtained| DECIMAL(5,2)| NOT NULL                       |
| submission_date| DATE       | nullable                       |
| remarks      | TEXT         | nullable                       |
| graded_by    | UUID         | FK -> Users(id)                |
| UNIQUE       |              | (project_id, student_id)       |

### Class Books Table
| Column       | Type         | Constraints                    |
| ------------ | ------------ | ------------------------------ |
| id           | UUID         | PK, auto-generated             |
| title        | VARCHAR(200) | NOT NULL                       |
| author       | VARCHAR(100) | NOT NULL                       |
| isbn         | VARCHAR(20)  | nullable                       |
| subject_id   | UUID         | FK -> Subjects(id)             |
| class_id     | UUID         | FK -> Classes(id)              |
| publisher    | VARCHAR(100) | nullable                       |
| edition      | VARCHAR(20)  | nullable                       |
| is_mandatory | BOOLEAN      | DEFAULT true                   |
| created_at   | TIMESTAMP    | DEFAULT now()                  |

---

## Phased Development Plan

---

## PHASE 1: Authentication & User Management

### Scope
- Admin account setup (seeded on first run)
- Admin can create, edit, deactivate, and list teacher accounts
- Teacher login/logout
- JWT-based session management
- Role-based access control middleware

### Features

#### 1.1 Admin Seed
- On first run, create a default admin account:
  - Email: `admin@educationhub.com`
  - Password: `Admin@123` (force change on first login)
- Admin cannot be deleted, only password can be changed

#### 1.2 Admin Dashboard - User Management
- **Create Teacher Account**: name, email, password, subject specialization
- **List All Teachers**: table with name, email, subject, status (active/inactive)
- **Edit Teacher**: update name, subject, reset password
- **Deactivate/Reactivate Teacher**: soft delete (toggle `is_active`)

#### 1.3 Authentication Flow
- Login page (shared for admin and teachers)
- JWT token stored in httpOnly cookie
- Token expiry: 8 hours
- Refresh token mechanism
- Logout clears token

#### 1.4 Role-Based Access Control
- Middleware to check `role` on protected routes
- Admin: full access to all routes
- Teacher: access only to assigned classes and their data

### API Endpoints - Phase 1

| Method | Endpoint              | Access  | Description                |
| ------ | --------------------- | ------- | -------------------------- |
| POST   | /api/auth/login       | Public  | Login                      |
| POST   | /api/auth/logout      | Auth    | Logout                     |
| GET    | /api/auth/me          | Auth    | Get current user profile   |
| POST   | /api/users/teachers   | Admin   | Create teacher account     |
| GET    | /api/users/teachers   | Admin   | List all teachers          |
| GET    | /api/users/teachers/:id| Admin  | Get teacher details        |
| PUT    | /api/users/teachers/:id| Admin  | Update teacher             |
| PATCH  | /api/users/teachers/:id/status | Admin | Activate/deactivate |
| PUT    | /api/auth/change-password | Auth | Change own password       |

### Phase 1 - Test Plan

| # | Test Case                                    | Type        |
|---|----------------------------------------------|-------------|
| 1 | Admin seed creates account on first run       | Integration |
| 2 | Login with valid credentials returns JWT      | Integration |
| 3 | Login with invalid credentials returns 401    | Integration |
| 4 | Accessing protected route without token returns 401 | Integration |
| 5 | Accessing admin route as teacher returns 403  | Integration |
| 6 | Create teacher with valid data succeeds       | Integration |
| 7 | Create teacher with duplicate email fails     | Integration |
| 8 | List teachers returns paginated results       | Integration |
| 9 | Deactivated teacher cannot login              | Integration |
| 10| Password change updates hash correctly        | Unit        |
| 11| JWT token expires after configured time       | Unit        |
| 12| Logout invalidates token                      | Integration |
| 13| UI: Login form validates required fields      | E2E         |
| 14| UI: Admin can see teacher management page     | E2E         |
| 15| UI: Teacher cannot see admin pages            | E2E         |

---

## PHASE 2: Class & Student Management

### Scope
- Admin/Teacher can create and manage classes
- Add students to classes
- View class rosters
- Student CRUD operations

### Features

#### 2.1 Class Management
- **Create Class**: name, section, academic year, assign class teacher
- **List Classes**: show all classes with student count
- **Edit Class**: update details, reassign teacher
- **Delete Class**: only if no students are enrolled

#### 2.2 Student Management
- **Add Student**: first name, last name, roll number, DOB, gender, parent info, address
- **List Students**: filterable by class, searchable by name/roll number
- **Edit Student**: update any field
- **Transfer Student**: move to a different class
- **Remove Student**: soft delete with reason

#### 2.3 Class Roster View
- View all students in a class sorted by roll number
- Display student count and class teacher name
- Export roster as CSV

### API Endpoints - Phase 2

| Method | Endpoint                     | Access       | Description              |
| ------ | ---------------------------- | ------------ | ------------------------ |
| POST   | /api/classes                 | Admin        | Create class             |
| GET    | /api/classes                 | Auth         | List all classes         |
| GET    | /api/classes/:id             | Auth         | Get class details        |
| PUT    | /api/classes/:id             | Admin        | Update class             |
| DELETE | /api/classes/:id             | Admin        | Delete class             |
| POST   | /api/students                | Admin/Teacher| Add student              |
| GET    | /api/students                | Auth         | List students (filtered) |
| GET    | /api/students/:id            | Auth         | Get student details      |
| PUT    | /api/students/:id            | Admin/Teacher| Update student           |
| PATCH  | /api/students/:id/transfer   | Admin        | Transfer student         |
| DELETE | /api/students/:id            | Admin        | Remove student           |
| GET    | /api/classes/:id/roster      | Auth         | Get class roster         |
| GET    | /api/classes/:id/roster/export| Auth        | Export roster CSV        |

### Phase 2 - Test Plan

| # | Test Case                                        | Type        |
|---|--------------------------------------------------|-------------|
| 1 | Create class with valid data succeeds             | Integration |
| 2 | Create class with duplicate name+section+year fails| Integration|
| 3 | Delete class with students returns error          | Integration |
| 4 | Add student with valid data succeeds              | Integration |
| 5 | Add student with duplicate roll number fails      | Integration |
| 6 | List students filters by class correctly          | Integration |
| 7 | Search students by name returns matches           | Integration |
| 8 | Transfer student updates class_id                 | Integration |
| 9 | Class roster returns sorted students              | Integration |
| 10| CSV export contains correct headers and data      | Integration |
| 11| Teacher can only see assigned classes              | Integration |
| 12| UI: Class creation form validates required fields  | E2E         |
| 13| UI: Student list pagination works                  | E2E         |
| 14| UI: Search filters update results in real-time     | E2E         |

---

## PHASE 3: Subjects & Exam Management

### Scope
- Create and assign subjects to classes
- Create exams (written and oral) per subject
- Manage exam schedules

### Features

#### 3.1 Subject Management
- **Add Subject**: name, code, assign to class and teacher
- **List Subjects**: filter by class
- **Edit Subject**: update name, reassign teacher
- **Delete Subject**: only if no exams/marks exist for it

#### 3.2 Exam Management
- **Create Exam**: name, type (written/oral), term, class, subject, max marks, date
- **List Exams**: filter by class, subject, term, type
- **Edit Exam**: update details (only if no marks entered)
- **Delete Exam**: only if no marks entered

#### 3.3 Exam Schedule View
- Calendar/table view of upcoming exams per class
- Filter by term and subject

### API Endpoints - Phase 3

| Method | Endpoint                     | Access       | Description              |
| ------ | ---------------------------- | ------------ | ------------------------ |
| POST   | /api/subjects                | Admin        | Create subject           |
| GET    | /api/subjects                | Auth         | List subjects            |
| GET    | /api/subjects/:id            | Auth         | Get subject details      |
| PUT    | /api/subjects/:id            | Admin        | Update subject           |
| DELETE | /api/subjects/:id            | Admin        | Delete subject           |
| POST   | /api/exams                   | Admin/Teacher| Create exam              |
| GET    | /api/exams                   | Auth         | List exams (filtered)    |
| GET    | /api/exams/:id               | Auth         | Get exam details         |
| PUT    | /api/exams/:id               | Admin/Teacher| Update exam              |
| DELETE | /api/exams/:id               | Admin/Teacher| Delete exam              |
| GET    | /api/classes/:id/exam-schedule| Auth        | Get exam schedule        |

### Phase 3 - Test Plan

| # | Test Case                                        | Type        |
|---|--------------------------------------------------|-------------|
| 1 | Create subject with valid data succeeds           | Integration |
| 2 | Create subject with duplicate code fails          | Integration |
| 3 | Delete subject with existing exams fails          | Integration |
| 4 | Create written exam with valid data succeeds      | Integration |
| 5 | Create oral exam with valid data succeeds         | Integration |
| 6 | Edit exam after marks entered fails               | Integration |
| 7 | Delete exam after marks entered fails             | Integration |
| 8 | List exams filters by term correctly              | Integration |
| 9 | List exams filters by type (written/oral)         | Integration |
| 10| Exam schedule returns chronological order          | Integration |
| 11| Teacher can only create exams for assigned subjects| Integration |
| 12| UI: Exam form shows correct type options           | E2E         |
| 13| UI: Exam schedule calendar renders correctly       | E2E         |

---

## PHASE 4: Marks Entry & Project Scores

### Scope
- Teachers enter marks for written and oral exams
- Teachers create projects and enter project scores
- Validation to ensure marks don't exceed max marks
- Bulk entry support

### Features

#### 4.1 Marks Entry
- **Enter Marks**: select exam -> display all students -> enter marks for each
- **Bulk Entry**: enter marks for all students in a class at once
- **Edit Marks**: update previously entered marks (with audit trail)
- **View Marks**: see marks per student per exam
- Validation: marks_obtained <= max_marks

#### 4.2 Project Management
- **Create Project**: title, description, subject, class, max marks, due date, term
- **List Projects**: filter by class, subject, term
- **Edit Project**: update details
- **Delete Project**: only if no scores entered

#### 4.3 Project Score Entry
- **Enter Scores**: select project -> display all students -> enter scores
- **Bulk Score Entry**: enter scores for all students at once
- **Edit Scores**: update previously entered scores
- Validation: marks_obtained <= max_marks

### API Endpoints - Phase 4

| Method | Endpoint                          | Access       | Description              |
| ------ | --------------------------------- | ------------ | ------------------------ |
| POST   | /api/marks                        | Teacher      | Enter marks (single)     |
| POST   | /api/marks/bulk                   | Teacher      | Enter marks (bulk)       |
| GET    | /api/marks/exam/:examId           | Auth         | Get marks for exam       |
| GET    | /api/marks/student/:studentId     | Auth         | Get marks for student    |
| PUT    | /api/marks/:id                    | Teacher      | Update marks             |
| POST   | /api/projects                     | Teacher      | Create project           |
| GET    | /api/projects                     | Auth         | List projects            |
| GET    | /api/projects/:id                 | Auth         | Get project details      |
| PUT    | /api/projects/:id                 | Teacher      | Update project           |
| DELETE | /api/projects/:id                 | Teacher      | Delete project           |
| POST   | /api/project-scores               | Teacher      | Enter score (single)     |
| POST   | /api/project-scores/bulk          | Teacher      | Enter scores (bulk)      |
| GET    | /api/project-scores/project/:id   | Auth         | Get scores for project   |
| PUT    | /api/project-scores/:id           | Teacher      | Update score             |

### Phase 4 - Test Plan

| # | Test Case                                        | Type        |
|---|--------------------------------------------------|-------------|
| 1 | Enter marks within max_marks succeeds             | Integration |
| 2 | Enter marks exceeding max_marks fails             | Integration |
| 3 | Bulk marks entry creates all records              | Integration |
| 4 | Duplicate marks entry (same student+exam) fails   | Integration |
| 5 | Edit marks updates correctly                      | Integration |
| 6 | Create project with valid data succeeds           | Integration |
| 7 | Delete project with scores fails                  | Integration |
| 8 | Enter project score within max succeeds           | Integration |
| 9 | Enter project score exceeding max fails           | Integration |
| 10| Bulk project score entry works                    | Integration |
| 11| Teacher can only enter marks for assigned subjects | Integration |
| 12| Marks audit trail records changes                  | Integration |
| 13| UI: Bulk entry form pre-fills student list          | E2E         |
| 14| UI: Marks validation shows error in real-time       | E2E         |
| 15| UI: Project form validates all required fields      | E2E         |

---

## PHASE 5: Report Card Generation

### Scope
- Generate comprehensive report cards per student
- Aggregate marks across all exams (written + oral) and projects
- Calculate totals, percentages, and grades
- PDF export of report cards

### Features

#### 5.1 Grade Calculation Rules

| Percentage Range | Grade | Remark          |
| ---------------- | ----- | --------------- |
| 90 - 100         | A+    | Outstanding     |
| 80 - 89          | A     | Excellent       |
| 70 - 79          | B+    | Very Good       |
| 60 - 69          | B     | Good            |
| 50 - 59          | C     | Satisfactory    |
| 40 - 49          | D     | Needs Improvement|
| Below 40         | F     | Fail            |

#### 5.2 Report Card Content
- **Header**: Institute name, academic year, student details (name, roll number, class)
- **Section 1 - Written Exams**: subject-wise marks for each term
- **Section 2 - Oral Exams**: subject-wise marks for each term
- **Section 3 - Projects**: project-wise scores for each term
- **Summary**:
  - Total marks obtained vs total max marks
  - Overall percentage
  - Overall grade
  - Subject-wise percentage and grade
  - Term-wise breakdown
- **Teacher Remarks**: editable text field
- **Footer**: class teacher signature, principal signature, date

#### 5.3 Report Card Views
- **Preview**: on-screen HTML preview before generating
- **PDF Export**: downloadable PDF per student
- **Bulk PDF**: generate PDFs for all students in a class (zipped)

#### 5.4 Report Card Dashboard
- Class-wise summary: average score, top performers, pass/fail count
- Subject-wise analysis: highest, lowest, average marks

### API Endpoints - Phase 5

| Method | Endpoint                              | Access       | Description                  |
| ------ | ------------------------------------- | ------------ | ---------------------------- |
| GET    | /api/report-cards/student/:id         | Auth         | Generate report card data    |
| GET    | /api/report-cards/student/:id/pdf     | Auth         | Download report card PDF     |
| GET    | /api/report-cards/class/:id           | Auth         | Class-wise summary           |
| GET    | /api/report-cards/class/:id/bulk-pdf  | Auth         | Download all PDFs (zip)      |
| PUT    | /api/report-cards/student/:id/remarks | Teacher      | Add/update teacher remarks   |
| GET    | /api/report-cards/class/:id/analytics | Auth         | Class analytics dashboard    |

### Phase 5 - Test Plan

| # | Test Case                                        | Type        |
|---|--------------------------------------------------|-------------|
| 1 | Report card includes all written exam marks       | Integration |
| 2 | Report card includes all oral exam marks          | Integration |
| 3 | Report card includes all project scores           | Integration |
| 4 | Percentage calculation is correct                 | Unit        |
| 5 | Grade assignment follows grading rules            | Unit        |
| 6 | Subject-wise breakdown is accurate                | Unit        |
| 7 | Term-wise breakdown is accurate                   | Unit        |
| 8 | PDF generation produces valid PDF file            | Integration |
| 9 | Bulk PDF creates zip with correct files           | Integration |
| 10| Report card with missing marks shows "N/A"        | Integration |
| 11| Class summary calculates averages correctly       | Integration |
| 12| Top performers list is sorted correctly           | Integration |
| 13| Teacher remarks are saved and displayed            | Integration |
| 14| UI: Report card preview renders correctly          | E2E         |
| 15| UI: PDF download triggers browser download         | E2E         |
| 16| UI: Analytics charts display accurate data         | E2E         |

---

## PHASE 6: Class Books Management

### Scope
- Add and manage books assigned to each class
- Categorize books by subject
- Mark books as mandatory or optional

### Features

#### 6.1 Book Management
- **Add Book**: title, author, ISBN, subject, class, publisher, edition, mandatory flag
- **List Books**: filter by class, subject, mandatory/optional
- **Edit Book**: update any field
- **Delete Book**: remove from class
- **Bulk Add**: upload CSV to add multiple books at once

#### 6.2 Class Book List View
- View all books for a class grouped by subject
- Distinguish mandatory vs optional books
- Print-friendly view for distribution to students

### API Endpoints - Phase 6

| Method | Endpoint                        | Access       | Description              |
| ------ | ------------------------------- | ------------ | ------------------------ |
| POST   | /api/books                      | Admin/Teacher| Add book                 |
| GET    | /api/books                      | Auth         | List books (filtered)    |
| GET    | /api/books/:id                  | Auth         | Get book details         |
| PUT    | /api/books/:id                  | Admin/Teacher| Update book              |
| DELETE | /api/books/:id                  | Admin        | Delete book              |
| POST   | /api/books/bulk-upload          | Admin/Teacher| Upload books via CSV     |
| GET    | /api/classes/:id/books          | Auth         | Get books for a class    |
| GET    | /api/classes/:id/books/print    | Auth         | Printable book list      |

### Phase 6 - Test Plan

| # | Test Case                                        | Type        |
|---|--------------------------------------------------|-------------|
| 1 | Add book with valid data succeeds                 | Integration |
| 2 | Add book with duplicate ISBN for same class fails | Integration |
| 3 | List books filters by class correctly             | Integration |
| 4 | List books filters by subject correctly           | Integration |
| 5 | List books filters by mandatory flag              | Integration |
| 6 | Edit book updates correctly                       | Integration |
| 7 | Delete book removes from class                    | Integration |
| 8 | Bulk CSV upload creates all books                 | Integration |
| 9 | Bulk CSV upload rejects invalid rows              | Integration |
| 10| Class book list groups by subject                  | Integration |
| 11| Print view renders without navigation elements     | E2E         |
| 12| UI: Book form validates ISBN format                | E2E         |
| 13| UI: CSV upload shows progress and errors           | E2E         |

---

## UI Pages & Navigation

### Admin Pages
| Page                    | Route                    | Description                    |
| ----------------------- | ------------------------ | ------------------------------ |
| Login                   | /login                   | Shared login page              |
| Admin Dashboard         | /admin/dashboard         | Overview with stats            |
| Manage Teachers         | /admin/teachers          | CRUD for teacher accounts      |
| Manage Classes          | /admin/classes           | CRUD for classes               |
| All Students            | /admin/students          | View all students              |
| Settings                | /admin/settings          | System settings                |

### Teacher Pages
| Page                    | Route                       | Description                    |
| ----------------------- | --------------------------- | ------------------------------ |
| Teacher Dashboard       | /teacher/dashboard          | Overview of assigned classes   |
| My Classes              | /teacher/classes            | List assigned classes          |
| Class Details           | /teacher/classes/:id        | View class roster & details    |
| Students                | /teacher/students           | Manage students                |
| Subjects                | /teacher/subjects           | View/manage subjects           |
| Exams                   | /teacher/exams              | Create and manage exams        |
| Enter Marks             | /teacher/marks              | Enter/edit exam marks          |
| Projects                | /teacher/projects           | Create and manage projects     |
| Project Scores          | /teacher/project-scores     | Enter/edit project scores      |
| Report Cards            | /teacher/report-cards       | Generate and view report cards |
| Class Books             | /teacher/books              | Manage class books             |

### Shared Components
- **Navigation Sidebar**: role-based menu items
- **Header**: user name, role badge, logout button
- **Data Tables**: sortable, filterable, paginated
- **Forms**: validated, with error messages
- **Modals**: for confirmations and quick edits
- **Toast Notifications**: success/error feedback

---

## Phase Completion Checklist

### Phase 1: Authentication & User Management
- [ ] Database setup and User table migration
- [ ] Admin seed script
- [ ] Auth API endpoints (login, logout, me, change-password)
- [ ] Teacher CRUD API endpoints
- [ ] JWT middleware and role-based access control
- [ ] Login page UI
- [ ] Admin teacher management UI
- [ ] All Phase 1 tests passing (15 tests)

### Phase 2: Class & Student Management
- [ ] Classes and Students table migration
- [ ] Class CRUD API endpoints
- [ ] Student CRUD API endpoints
- [ ] Class roster and CSV export
- [ ] Class management UI
- [ ] Student management UI
- [ ] All Phase 2 tests passing (14 tests)

### Phase 3: Subjects & Exam Management
- [ ] Subjects and Exams table migration
- [ ] Subject CRUD API endpoints
- [ ] Exam CRUD API endpoints
- [ ] Exam schedule view
- [ ] Subject management UI
- [ ] Exam management UI
- [ ] All Phase 3 tests passing (13 tests)

### Phase 4: Marks Entry & Project Scores
- [ ] Marks, Projects, and Project Scores table migration
- [ ] Marks entry API endpoints (single + bulk)
- [ ] Project CRUD API endpoints
- [ ] Project scores API endpoints (single + bulk)
- [ ] Marks entry UI with bulk entry
- [ ] Project management UI
- [ ] Project scores entry UI
- [ ] All Phase 4 tests passing (15 tests)

### Phase 5: Report Card Generation
- [ ] Report card data aggregation API
- [ ] Grade calculation logic
- [ ] PDF generation service
- [ ] Bulk PDF with zip
- [ ] Report card preview UI
- [ ] Analytics dashboard UI
- [ ] All Phase 5 tests passing (16 tests)

### Phase 6: Class Books Management
- [ ] Class Books table migration
- [ ] Book CRUD API endpoints
- [ ] Bulk CSV upload endpoint
- [ ] Class book list and print view
- [ ] Book management UI
- [ ] CSV upload UI
- [ ] All Phase 6 tests passing (13 tests)

---

## Running the Project

```bash
# Install dependencies
npm install

# Setup database
npx prisma migrate dev

# Seed admin account
npm run seed

# Run development server
npm run dev

# Run tests
npm test

# Run specific phase tests
npm test -- --testPathPattern="phase1"
npm test -- --testPathPattern="phase2"
# ... and so on
```

---

## Total Test Coverage Target

| Phase   | Tests |
| ------- | ----- |
| Phase 1 | 15    |
| Phase 2 | 14    |
| Phase 3 | 13    |
| Phase 4 | 15    |
| Phase 5 | 16    |
| Phase 6 | 13    |
| **Total** | **86** |
