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

## Note for Developers

> ⚠️ **Before deploying to production:** copy `.env.example` to `.env` and set a strong, random `JWT_SECRET`. If the variable is unset, `src/utils/jwt.ts` currently falls back to a hardcoded `'default-secret'` — acceptable for local development only. For production, replace that fallback so the app **fails to start** without a real secret instead of silently signing tokens with a known value.

## Further Documentation

| File | Contents |
|------|----------|
| [LOGIN_CREDENTIALS.md](LOGIN_CREDENTIALS.md) | Every sample login + feature walkthrough notes |
| [EDUCATION_HUB.md](EDUCATION_HUB.md) | Original phased development & testing plan |
| [ROLES_AND_DUTIES.md](ROLES_AND_DUTIES.md) | Duties of teachers, co-teachers, staff, volunteers |
| [logo.md](logo.md) | Logo variants for the sample organizations |
| [cost.md](cost.md) | Cloud hosting cost analysis & recommendations |
