# Education Hub

A multi-tenant school management platform. Each school (organization) gets its own isolated space with role-based logins for admins, teachers, students, parents, volunteers, and administrative staff — while a platform super admin oversees all organizations from above.

Built with **Node.js + Express 5 + TypeScript + Prisma (SQLite)** on the backend and **React 18 + Vite + Tailwind CSS** on the frontend.

---

## Quick Start

```bash
npm install                 # backend deps
cd client && npm install    # frontend deps
cd ..

npx prisma migrate dev      # create/update the local database
npm run seed:mock           # sample orgs, users, classes, marks, logos

npm run dev                 # backend  -> http://localhost:3000
cd client && npm run dev    # frontend -> http://localhost:5173
```

All sample logins are documented in **[LOGIN_CREDENTIALS.md](LOGIN_CREDENTIALS.md)** (passwords are `Password@123`; super admin is `Super@123`). Dev-mode login screens show credential helper panels.

| Portal | URL |
|--------|-----|
| Staff (Admin / Teacher / Volunteer / Staff) | `/login` |
| Parents & Students | `/parent-login` |
| Join with invitation code | `/join` |
| Register a new organization | `/register` |
| Platform Super Admin | `/super-login` |

---

## Roles at a Glance

| Role | What they can do |
|------|------------------|
| **Super Admin** | Platform-level: enable/disable whole organizations (cuts live sessions), view platform stats, create/edit org admins, reset admin passwords |
| **Admin** | Everything inside their org: users, classes, students, subjects, exams, approvals, schedules, documents, calendar, invitations, moderation |
| **Teacher** | Their assigned classes only: enter marks, assign homework, manage books, record attendance, submit documents, view their own schedule |
| **Parent** | Their children's details, attendance, report cards, books, class schedule; multiple parents per student supported |
| **Student** | Own dashboard: marks, homework, books, documents, class schedule, calendar |
| **Volunteer** | Read-only marks/homework; can record student attendance; sees own attendance |
| **Admin Staff** | Sees their customizable duty assignments (class / lab / office / custom), documents, calendar |
| **Moderator** *(assignment, not a role)* | Any user the admin designates; approves content uploads |

See **[ROLES_AND_DUTIES.md](ROLES_AND_DUTIES.md)** for the full duties document (also editable in-app by admins).

---

## Core Capabilities

### Multi-tenancy & Organizations
- Every org has its own slug-based login (`sunrise-academy`, `green-valley`, …), users, data, logo, and report card branding — fully isolated.
- Self-service org onboarding at `/register`.
- Custom grade levels per org (a nonprofit can use its own level names instead of Class 1–12).

### Platform Super Admin
- Sits above all orgs: platform stats, sortable org table, enable/disable an org (all its users are locked out instantly, even mid-session), manage/reset each org's admin accounts.

### User & Account Management
- **Consolidated Users page**: every account in the org in one table — search, role/status filters, sorting.
- Activate/deactivate, **lock/unlock**, and **reset password** for any user. Enforcement is immediate: deactivating or locking kills existing sessions on the next request, not just future logins.
- Safety guards: no self-service on your own account; the last usable admin can never be deactivated or locked.
- **Invite-only registration**: teachers, students, parents, volunteers, and staff can only join via single-use, expiring invitation codes created by the admin (optionally locked to an email; student/parent invites link the student record). No open self-registration.

### Classes, Students & Parents
- Classes with optional sections; students organized by grade level; transfer between classes.
- **Multiple teachers per class** (co-teaching) — teachers only ever see their assigned classes.
- Student login accounts, optional **student photo** (prints on the marksheet).
- Parent accounts linked to one or more children; **multiple parents per student**; parent names are hyperlinks leading to a parent detail page (account status, all linked children).
- Parents with **no active enrolled student** are greyed out system-wide with a clear tag.

### Attendance
- Student attendance by class/date (admin, teacher, volunteer can record).
- **Volunteer attendance** recorded by admin/teacher; volunteers can view but not change their own record.

### Subjects, Exams & Marks
- Subjects per class, including custom subjects.
- Exam types: mid-term oral/written, final oral/written, class tests, projects.
- **Marks approval workflow**: teacher enters marks → submits → admin reviews the actual entries → approves or rejects with a note. Report cards are blocked until every exam in the class is approved.
- **Create exam from a file**: upload a PDF (book chapter, notes, a real paper) and generate a gradable paper — either a **Quiz** (MCQ / fill-in-the-blank / true-false with an answer key) or a **Subjective Test** (comprehension + key-term questions). Questions are generated **in the document's language** (Hindi files produce fully-Hindi papers); the source text itself is never part of the exam. Papers are viewable in-app and downloadable as **PDFs with an embedded Devanagari font**; the answer key is staff-only.

### Report Cards (Marksheets)
- Formatted, color report cards with the org logo, optional student photo, attendance summary, per-subject marks across exam types, percentages, grades, and remarks.
- Fully customizable: institute name/tagline/address, principal, custom grading scale, and show/hide toggles (attendance, photo, grade, percentage, rank, remarks).
- One-click **color PDF download** with consistent branding (SVG logos are auto-converted to PNG).

### Homework & Books
- Homework per class/subject with due dates; a book from the library can be attached (only approved books).
- Book catalog per subject/class incl. custom categories, with **PDF/scanned copy uploads**; students and parents see their class's books.

### Content Moderation
- Admin assigns any number of **moderators** from the Users page.
- Books and school documents uploaded by non-moderators sit in **pending** state — invisible to everyone but the uploader — until a moderator/admin approves them from the **Moderation** queue (with inline file preview and full details). Rejections carry a note; editing resubmits.
- Teachers and staff can submit school documents (subject to approval); admins/moderators publish instantly.

### Content Safety
- **Upload-time gate**: every upload is scanned *before* it is accepted. Content with adult material or profanity — in the file text, title, description, or exam questions — is **rejected outright**: the file is deleted and the uploader gets a clear error naming the categories. Blocked content never enters the system. Covers documents, books (metadata + file copies), exam file imports, and exam question payloads.
- Admin-only **Content Safety** page inventories every upload in the org (book files, documents, exam papers, generated exam questions, student photos, logos) and scans all readable text against rule-based wordlists.
- Items with adult content or profanity are **flagged**; violence/substance mentions and images (which can't be auto-analyzed) go to **needs manual review**; the rest are clean. Admins can mark items safe — decisions survive re-scans.

### Documents & Communication
- **School documents** (schedules, events, notices, circulars) uploaded by admin (or submitted by teachers/staff via moderation), visible to selected audiences (teachers/students/parents/volunteers/staff).
- **Roles & Duties document** — admin-editable, viewable by everyone.

### Schedules & Calendar
- **Class schedules**: weekly per-class timetable (subject periods or custom slots like Assembly/Lunch, with rooms). Overlap-checked.
- **Teacher schedules**: each class period can be assigned a teacher; admin adds duties/meetings separately. **Collision detection in every direction** — a teacher can never be double-booked across classes or against duties. Teachers get a "My Schedule" page.
- **School calendar**: admin-managed holidays (read-only for everyone else) with class/teacher schedule overlays — periods show on weekday cells, clicking a date lists that day's timetable, and holidays automatically suppress classes.

### Tables & UX
- Every tabular view supports **search, filtering, and column sorting** (shared table utilities).
- Dev-mode credential panels on login screens; session-expiry handling that never hijacks failed logins.

---

## Key Flows

1. **Onboard a school** — `/register` → org + first admin created → admin logs in at `/login` with the org slug.
2. **Staff a school** — admin creates teachers/staff directly or sends **invitation codes**; invitees join at `/join/<code>` and are auto-logged-in on acceptance.
3. **Set up academics** — grade levels → classes (+ assign teachers, co-teachers) → students (+ optional photos, logins) → parents linked to children → subjects per class.
4. **Daily teaching** — teachers record attendance, assign homework (optionally from approved books), follow their schedule.
5. **Assessment cycle** — create exams (manually or **from a file**) → enter marks → submit for approval → admin reviews entries → approve/reject → generate & print report cards.
6. **Content pipeline** — teacher uploads a book/document → moderator reviews in the queue → approve (published to its audience) or reject with a note → uploader fixes and resubmits.
7. **Scheduling** — admin builds class timetables → assigns teachers per period (clash-checked) → adds duties/meetings → everyone sees the result on the calendar, holidays override.
8. **Account lifecycle** — admin manages every account from Users (deactivate/lock/reset, moderator assignment); super admin manages whole orgs.

---

## Project Structure

```
├── src/                    # Express backend (TypeScript)
│   ├── app.ts              # route mounting
│   ├── controllers/        # one per domain (auth, exams, moderation, …)
│   ├── routes/             # route definitions + upload handling (multer)
│   ├── middleware/auth.ts  # JWT auth w/ live user checks, role guards
│   ├── utils/              # PDF generation, exam generator, conflict checks
│   └── prisma/             # client + seed scripts
├── prisma/schema.prisma    # data model (SQLite, org_id on all tables)
├── client/                 # React + Vite + Tailwind frontend
│   └── src/pages/          # one page per feature, per role
├── uploads/                # uploaded files (logos, books, papers, photos)
├── assets/                 # generated org logos, Devanagari fonts
└── *.md                    # docs (see below)
```

## Useful Commands

```bash
npm run dev          # backend with hot reload (port 3000)
npm run seed:mock    # full sample data for all features
npm test             # backend test suite (Jest)
cd client && npm run dev    # frontend dev server (port 5173)
cd client && npx vite build # production build
```

## Plugging an AI Agent into the Help Chat (optional, local)

The in-app help chat is rule-based by default (curated knowledge base, no AI). Any developer can optionally plug in **their own AI agent** — a local LLM, a CLI wrapper around an API, anything — via one env variable in `.env` (which is gitignored, so your agent config never leaves your machine):

```bash
# .env
CHAT_AGENT_CMD=python3 /path/to/your/agent.py --ask
CHAT_AGENT_TIMEOUT_MS=30000   # optional, default 30s
```

**The contract is deliberately tiny** so any agent works:
- The command is executed **without a shell**; the user's question (prefixed with a short project-grounding instruction) is appended as the **final argument**.
- Your agent prints a **plain-text answer to stdout** and exits `0`.
- Non-zero exit, timeout, or empty output → the chat silently falls back to the built-in knowledge base.

Example agents: an [Ollama](https://ollama.com)-backed script (`python3 chat_agent.py --ask "<question>"` hitting `http://localhost:11434`), a shell script calling any LLM API, or any executable meeting the contract.

**The safety pipeline still wraps your agent on both sides.** Before the AI sees anything: input sanitization, the secrets/credentials filter, and the project-scope gate. After it answers: the reply is scanned with the same kid-safety wordlists used by Content Safety (a flagged reply is discarded and the knowledge base answers instead) and secret-shaped content is redacted. Answers from an AI agent are labeled "answered by local AI agent · safety-screened" in the chat widget, with the full step trace visible per message.

## Library & Timetable (depth)

Two commonly-expected modules built on existing data (Phase 5 of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)).

- **Library circulation** — a **Library** page (admin/teacher) to issue books to students, return them, and track due dates and fines. Each book now has a copy count; the desk blocks an issue when all copies are out or the student already holds that title. Returns compute an overdue fine (per-day), which can be marked paid; the page summarizes books out, overdue, and unpaid fines. Students see their own borrowing history via `my-loans`.
- **Timetable auto-generation** — an **Auto-generate** button on the Class Schedules page lays the class's subjects across a Mon–Fri × periods grid, assigns each subject's teacher when the class has one whose subject matches, and **skips any teacher who would be double-booked** (validated with the very same `findTeacherConflict` used for manual scheduling). It writes straight into the existing schedule slots (so it shows on the calendar) and reports any periods it had to leave without a teacher. Regenerating an existing timetable requires an explicit "replace".

## Analytics & Insight

An admin **Analytics** page that turns the data you already have into decisions (Phase 4 of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)) — no new data model, just aggregation, and charts drawn with plain CSS/SVG (no external chart library or CDN).

- **Overview** — active students, teachers, classes, overall attendance rate, marks pending approval, and content-safety items still needing review.
- **Attendance trend** — attendance rate by month for the last 6 months (bars turn red below 75%).
- **Grade distribution** — approved-exam percentages bucketed (0–39 … 90–100), plus an average-by-subject breakdown.
- **At-risk students** — everyone flagged for attendance below 75% or an average below 40%, with the specific reason(s), worst first.
- **Export** — one-click CSV of every active student with class, attendance %, and average %.

All endpoints are admin-only and scoped to the caller's organization. (Platform-wide stats for the super admin already live on the Super Admin dashboard.)

## Admissions & Enrollment

A prospective-student funnel that feeds the existing onboarding (Phase 3 of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)).

- **Public enquiry form** — each school has a shareable, no-login page at `/apply/<org-slug>` where prospective families submit an enquiry (student + guardian details, grade applying for, a message). Free text is checked by the content-safety scanner; the applicant gets an acknowledgement email.
- **Admin funnel** — the **Admissions** page shows every enquiry with per-stage counts and moves each through `enquiry → reviewing → accepted / rejected → enrolled`. Accept/reject decisions email the applicant.
- **Convert to student** — one click enrolls an accepted applicant: it creates the `Student` in a chosen class (auto-assigning a roll number if none is given), links the admission, and can **email the guardian a parent sign-up link** — reusing the same single-use invitation flow as the rest of onboarding. All stage changes and enrollments are written to the **audit log**.

## Learning Loop (submissions & online quizzes)

Closes the assign → do → grade → gradebook loop (Phase 2 of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)).

- **Assignment submissions** — students turn in work against a homework item (file and/or note) from their dashboard. Every upload passes the **same content-safety gate** as the rest of the app. Teachers see all submissions per homework and grade them inline (grade / out-of / feedback); the student and their parents are **notified** when it's graded. A graded submission is locked from further edits.
- **Online quizzes** — a quiz-format exam (questions generated from a file, see below) becomes a **timed, student-facing quiz**. Objective questions (MCQ / true-false / fill-in-the-blank) are **auto-graded** against the answer key; the score is written back as a **Mark**, so it flows straight into the existing gradebook and report cards. Students see per-question results with the correct answers after submitting; teachers see every attempt. Correct answers are never sent to the browser before submission.

Students take quizzes at **My Quizzes** on their dashboard; teachers manage submissions from the **Submissions** button on each homework card.

## Notifications (email · in-app · SMS)

Users are kept informed instead of having to log in and check (Phase 1 of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)).

- **In-app** — a notification bell (top-right, on every role's dashboard) shows unread count, a dropdown of recent items (click to open the related page), "mark all read", and an inline **per-category × per-channel preferences** panel. Always on.
- **Email** — sent via SMTP when configured (`SMTP_URL` or `SMTP_HOST/PORT/USER/PASS`, plus `MAIL_FROM`). With nothing configured, email is skipped (logged in dev) and never blocks anything. Uses `nodemailer`.
- **SMS** — an optional **pluggable adapter** mirroring the help-chat AI contract: point `SMS_CMD` at any executable; the recipient and message are appended as its final two arguments. Off by default; config lives in `.env` (gitignored) so provider credentials never leave your machine.

Each user controls delivery per category (**marks, moderation, attendance, invitation, general**) and per channel from the bell's settings. A missing preference means defaults (in-app + email on, SMS off).

**Events wired so far:** marks approved → the affected students **and their parents**; content (book/document) approved or rejected → the uploader; invitation created with an email → the invitee gets a join-link email. Delivery is best-effort and fired after the request responds, so notifications never slow the underlying action. See all env vars in `.env.example`.

## Note for Developers

> ⚠️ **Before deploying to production:** copy `.env.example` to `.env` and set a strong, random `JWT_SECRET`. In production (`NODE_ENV=production`) the app now **refuses to start** if `JWT_SECRET` is missing or left as the known `'default-secret'` value (`src/utils/jwt.ts`), so tokens can never be signed with a guessable key. Outside production a convenience fallback keeps local dev and the test suite running without configuration.

**Other hardening (Phase 0 of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)):**
- **Auth rate limiting** — login, super-login, org registration, and invite lookup/accept are throttled per IP with escalating lockout (`src/middleware/rateLimit.ts`); disabled automatically under `NODE_ENV=test`. In-memory today; move to a shared store (Redis) when running multiple instances.
- **Audit log** — privileged actions (activate/deactivate, lock/unlock, moderator assignment, password resets, org enable/disable, content approvals, content-safety decisions) are recorded to an append-only `AuditLog` table via `src/utils/audit.ts`, viewable by admins at **Audit Log** in the sidebar (super admin sees the whole platform). Writes are best-effort and never block the underlying action.
- **Isolated test DB** — `npm test` builds a throwaway `prisma/test.db` (Jest global setup) so the suite never touches your `dev.db`.

## Further Documentation

| File | Contents |
|------|----------|
| [LOGIN_CREDENTIALS.md](LOGIN_CREDENTIALS.md) | Every sample login + feature walkthrough notes |
| [EDUCATION_HUB.md](EDUCATION_HUB.md) | Original phased development & testing plan |
| [ROLES_AND_DUTIES.md](ROLES_AND_DUTIES.md) | Duties of teachers, co-teachers, staff, volunteers |
| [logo.md](logo.md) | Logo variants for the sample organizations |
| [cost.md](cost.md) | Cloud hosting cost analysis & recommendations |
