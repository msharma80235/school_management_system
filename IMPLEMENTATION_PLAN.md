# Education Hub — Phased Implementation Plan

*Derived from [COMPARATIVE_ANALYSIS.md](COMPARATIVE_ANALYSIS.md). Prepared 2026-07-08.*

This plan sequences the work that makes Education Hub adoptable and then defensible. Each phase names its **goal**, **deliverables**, the **data-model / backend / frontend** changes mapped onto the existing architecture, what it **reuses**, its **dependencies**, a rough **effort** (S ≈ days, M ≈ 1–2 weeks, L ≈ 3+ weeks), and an **exit criterion** so "done" is unambiguous.

> **Deferred — not in any phase:** **Fee management, invoicing, and online payments/gateway integration** are parked in the [Backlog](#backlog) at the user's direction. The plan below assumes they arrive later; the Phase 1 notification backbone is built so that fee reminders can hang off it when that work is scheduled.

**Guiding principle:** close the table-stakes gaps that block adoption, finish the half-built learning loop, then lean into the safety/privacy moat that the market and regulation are moving toward.

**Status legend:** ⬜ not started · 🔵 in progress · ✅ done. Progress is tracked per-phase and per-deliverable below.

| Phase | Status |
|-------|--------|
| 0 — Foundations & Hardening | ✅ done (2026-07-08) |
| 1 — Communication & Notifications | ✅ done (2026-07-08) |
| 2 — Learning Loop | ✅ done (2026-07-08) |
| 3 — Admissions & Enrollment | ✅ done (2026-07-09) |
| 4 — Analytics & Insight | ✅ done (2026-07-09) |
| 5 — Depth & Parity | ✅ done (2026-07-09) |
| 6 — Scale & Reach | ⬜ not started |
| 7 — Safety & Privacy Moat | ⬜ not started |

---

## Phase 0 — Foundations & Hardening — ✅ DONE (2026-07-08)
*Quick, parallelizable, derisks everything that follows. Do before or alongside Phase 1.*

- **Goal:** make the platform safe to grow on.
- **Deliverables:**
  - ✅ Refuse to boot in production without a real `JWT_SECRET` (remove the `'default-secret'` fallback path for prod; keep it dev-only).
  - ✅ Rate limiting + lockout backoff on all auth routes (login, join, register, super-login).
  - ✅ Append-only **audit log** of privileged actions (approvals, password resets, activate/deactivate/lock, org enable/disable, moderator assignment, content-safety decisions).
  - ✅ Test harness (isolated test DB, no more clobbering `dev.db`) + first integration tests for the highest-risk paths: the upload safety gate, JWT guard, rate limiter, and privileged-action audit.
- **Data model:** new `AuditLog` (actor_id, org_id, action, target_type, target_id, metadata JSON, created_at). ✅ migrated (`20260708202441_add_audit_log`).
- **Backend:** auth middleware/limiter; a small `audit()` helper called from privileged controllers; `src/utils/jwt.ts` prod guard. ✅
- **Frontend:** admin-only **Audit Log** page (read-only, filter by actor/action/date) — reuses shared table utilities. ✅
- **Reuses:** existing role guards, shared table search/sort/filter.
- **Dependencies:** none.
- **Effort:** M.
- **Exit criterion:** app won't start in prod without a secret; brute-force attempts are throttled; every privileged action writes an audit row; CI runs the new tests green. ✅ **all met.**

> **Progress log**
> - 2026-07-08: Started Phase 0. Implemented JWT production-secret enforcement (`src/utils/jwt.ts`) and an in-memory rate limiter (`src/middleware/rateLimit.ts`) applied to `/login` and `/super-login` (disabled under `NODE_ENV=test`).
> - 2026-07-08: **Completed Phase 0.**
>   - **JWT guard** — throws at load in production if `JWT_SECRET` is missing/default; dev & test keep the fallback.
>   - **Rate limiting** — `authRateLimit` (10 req / 15 min, escalating block) on login, super-login, org register, and invite lookup/accept.
>   - **Audit log** — new `AuditLog` model + migration; `audit()` helper wired into `orgUsers` (activate/deactivate, lock/unlock, moderator, password reset), `super` (org enable/disable, admin create/update/status/reset), `moderation` (book/document approve/reject), `contentSafety` (mark safe), and `auth` (self password change). New read-only `GET /api/audit` (admin → own org, superadmin → all) + admin **Audit Log** sidebar page.
>   - **Test harness** — Jest `globalSetup` builds a throwaway `prisma/test.db`; `setupFiles` points workers at it; `cleanDatabase` extended; transpile-only transform matches how the app runs under `tsx`.
>   - **Tests green:** `npm test` → **2 suites, 27 tests passing** (11 new Phase 0 tests covering JWT guard, rate limiter, upload safety gate, and audit trail incl. org scoping + non-admin denial; 16 legacy tests brought onto the current org-based login flow).
>   - **Verified:** `cd client && npx vite build` succeeds with the new Audit Log page/route/nav.
>
> **Follow-ups deferred to later phases (not blockers):** rate limiter is in-memory (move to Redis in Phase 6 multi-server); audit-log writes are fire-and-forget; `AuditLog` retention/rotation not yet defined; ClamAV/file-malware scan intentionally deferred to Phase 7.

---

## Phase 1 — Communication & Notifications — ✅ DONE (2026-07-08)
*Build this first among features: nearly everything else (approvals, absences, later fee reminders) has something to announce.*

- **Goal:** the platform can reach users instead of waiting for them to log in.
- **Deliverables:**
  - ✅ Event-triggered **email** via nodemailer + SMTP (marks approved, invitation sent, moderation decision). *(Attendance-absence + document-published-to-audience events deferred — see follow-ups.)*
  - ✅ **In-app notifications** per role (bell + dropdown on every dashboard).
  - ✅ **SMS as a pluggable adapter** mirroring the AI-agent pattern (`SMS_CMD`, env-configured, off by default).
  - ✅ Per-user notification preferences (channel × category opt-out).
- **Data model:** `Notification` (user_id, org_id, category, title, body, link, read_at), `NotificationPreference` (user × category × {in_app,email,sms}); plus `User.phone` for the SMS adapter. Two-way messaging deferred (kept Phase 1 tight). ✅ migrated (`20260708204115_add_notifications`).
- **Backend:** `notification.controller` + routes; a `notify()`/`notifyMany()` service invoked at key events; `email.ts` transport; `smsAdapter.ts` (env `SMS_CMD`, gitignored config, same contract discipline as `CHAT_AGENT_CMD`). ✅
- **Frontend:** notification bell + dropdown with inline preference settings (single self-contained component in `Layout`, so it works for all roles without touching route blocks). ✅
- **Reuses:** the pluggable-local-adapter pattern already proven by the AI chat; `.env` discipline; role guards.
- **Dependencies:** Phase 0 audit log (nice to have, not blocking).
- **Effort:** L.
- **Exit criterion:** a parent receives an email + in-app notification when their child's marks are approved, and can opt out of a category. ✅ **met** (covered by an integration test).

> **Progress log**
> - 2026-07-08: **Completed Phase 1.**
>   - **Data + service:** `Notification` + `NotificationPreference` models (+ `User.phone`) and migration; `notify()`/`notifyMany()` respect per-user, per-category channel prefs (defaults: in-app + email on, SMS off), write the in-app row synchronously and fire email/SMS without blocking the request.
>   - **Channels:** `email.ts` (nodemailer; SMTP via `SMTP_URL` or discrete host settings; no-op + dev log when unconfigured; never throws) and `smsAdapter.ts` (pluggable `SMS_CMD`, recipient+message as final args, off by default).
>   - **API:** `GET /api/notifications`, `/unread-count`, `POST /read-all`, `PATCH /:id/read` (user-scoped), `GET`/`PUT /preferences`.
>   - **Events wired:** marks approved → students + parents (`approveMarks` and `bulkApprove`); book/document approve/reject → uploader; invitation-with-email → join-link email to the invitee.
>   - **Frontend:** `NotificationBell` (fixed top-right in `Layout`): unread badge with 30s polling, dropdown list (click marks read + navigates to the item's link), mark-all-read, and an inline per-category × per-channel preferences grid.
>   - **Docs:** `.env.example` (APP_URL, SMTP_*, MAIL_FROM, SMS_CMD) and a README "Notifications" section.
>   - **Tests green:** `npm test` → **3 suites, 34 passing** (+7 Phase 1: notify defaults/opt-out, endpoint CRUD incl. cross-user guard, preferences, and the marks-approval → parent+student integration with an opt-out case). Isolated test-DB teardown (`cleanDatabase`) extended to all tables. `cd client && npx vite build` succeeds.
>
> **Follow-ups deferred to later work (not blockers):** attendance-absence → parents and document-published → audience events not yet wired; no digest/batching (each event sends immediately); no UI to edit `User.phone` yet (settable via API/seed); two-way messaging out of scope; standalone full-page notifications view could complement the dropdown.

---

## Phase 2 — Learning Loop (Submissions + Online Quiz) — ✅ DONE (2026-07-08)
*Highest leverage: reuses the most existing code.*

- **Goal:** close the assign→submit→grade→gradebook loop, and finish the exam feature you're ~60% into.
- **Deliverables:**
  - ✅ **Assignment submission:** students turn in work against a homework item → routed through the **existing `gateUpload` safety gate** → teacher grades in-app → student + parents notified.
  - ✅ **Online quiz delivery:** a quiz-format exam becomes a timed, student-facing assessment auto-graded against the answer key; the score is written back as a `Mark` (lands in the gradebook); attempts stored and surfaced in results.
- **Data model:** `Submission` (homework_id, student_id, file_path, note, status, grade, max_grade, feedback); `QuizAttempt` + `QuizResponse` (exam_id/student_id/question_id, answer, is_correct, awarded); `Exam.time_limit_min`. ✅ migrated (`20260708205900_add_submissions_and_quiz`).
- **Backend:** `submission.controller` (submit/list/grade/my-submission) + `quiz.controller` (get/submit/result/attempts/my-quizzes); routes under `/api/homework/:id/*`, `/api/submissions/:id/grade`, `/api/exams/:id/quiz*`; notifications on graded submissions; `createExam` threads `time_limit_min`. ✅
- **Frontend:** interactive `HomeworkList` (submit/resubmit + status/grade) for students; teacher **Submissions** modal with inline grading; **My Quizzes** on the student dashboard; `QuizTake` page (timer + auto-submit, per-question results). ✅
- **Reuses:** `gateUpload`, the marks table/gradebook, `examGenerator`/`ExamQuestion`, Phase 1 notifications, the existing multer/upload + `uploads/` static serving.
- **Dependencies:** Phase 1 (for submit/grade notifications).
- **Effort:** L.
- **Exit criterion:** a student submits homework and takes a generated quiz; the quiz auto-scores and the teacher-graded submission mark lands in the gradebook. ✅ **met** (integration-tested).

> **Progress log**
> - 2026-07-08: **Completed Phase 2.**
>   - **Data:** `Submission`, `QuizAttempt`, `QuizResponse` models (+ `Exam.time_limit_min`) and migration; unique constraints per (homework,student) and (exam,student).
>   - **Submissions:** student submit (file+note through `gateUpload`; graded submissions locked), teacher list + inline grade (with `canAccessClass` guard), student `my-submission`; graded → student & parents notified (category `marks`). `getMyHomework` now returns each item's `my_submission`.
>   - **Quiz:** student fetch (answers hidden, attempt clock starts), submit (auto-grade objective questions, persist attempt+responses, upsert a clamped `Mark`), result (answers revealed), teacher attempts list, and student `my-quizzes` discovery. Design note: a quiz **is** an Exam, so the auto-score naturally becomes a Mark — that's the clean gradebook path. Homework grades stay on the submission (homework has no exam).
>   - **Frontend:** `HomeworkList` gained an interactive submit/resubmit control (students only; parents stay read-only); `QuizTake` page with countdown + auto-submit and a per-question result view; **My Quizzes** card on the student dashboard; **Submissions** grading modal on the teacher homework page; student `quiz/:examId` route.
>   - **Tests green:** `npm test` → **4 suites, 39 passing** (+5 Phase 2: submission submit/grade/notify, safety-gate block, graded-lock; quiz serve-without-answers/auto-grade/Mark-write/result/no-resubmit and cross-class rejection). `cleanDatabase` teardown extended for the new tables. `cd client && npx vite build` succeeds.
>
> **Follow-ups deferred (not blockers):** no UI yet to set a quiz's `time_limit_min` at creation (backend accepts it; defaults to untimed) or a teacher quiz-attempts screen in `ExamMarks`; quiz Marks are written directly (not run through the marks-approval workflow); a submissions/quiz view for parents is read-only via existing pages only.

---

## Phase 3 — Admissions & Enrollment — ✅ DONE (2026-07-09)
- **Goal:** capture prospective students and convert them into enrolled records.
- **Deliverables:**
  - ✅ Public per-org **enquiry form** (at the org slug, `/apply/:slug`).
  - ✅ Admin **funnel** (enquiry → reviewing → accepted/rejected → enrolled), tied into the existing invite-based onboarding.
  - ✅ Status emails to applicants (acknowledgement, accept/reject decisions, welcome + parent sign-up link).
- **Data model:** a single stage-based `Admission` model (prospective student + guardian + `stage` + decision + optional `student_id` link) — **consolidated** rather than a separate `Enquiry`/`Application` split, which is simpler for a funnel and avoids a redundant table. ✅ migrated (`20260708…_add_admissions`).
- **Backend:** public enquiry route (rate-limited via `authRateLimit`, safety-scanned free text); admissions controller (list+counts, stage transitions, convert); conversion reuses student creation + the invitation flow; stage/enroll actions write to the Phase 0 **audit log**.
- **Frontend:** public `AdmissionEnquiry` page; admin `Admissions` funnel (stage filter + counts, review/accept/reject, copy-enquiry-link) with a **Convert** modal (pick class, optional roll number, optional guardian parent-invite that surfaces the join link). Sidebar **Admissions** link.
- **Reuses:** invitation onboarding, content-safety scanner, Phase 0 rate limiting + audit log, Phase 1 email, `/auth/org/:slug` lookup.
- **Dependencies:** Phase 0, Phase 1.
- **Effort:** M–L.
- **Exit criterion:** a public enquiry becomes an application, and an admin converts it to an enrolled student with a parent invite sent. ✅ **met** (integration-tested).

> **Progress log**
> - 2026-07-09: **Completed Phase 3.**
>   - **Data:** single `Admission` model (+ `Organization.admissions`, `Student.admission`), stage funnel `enquiry → reviewing → accepted/rejected → enrolled`, unique `student_id` link once converted.
>   - **Public enquiry:** `POST /api/admissions/enquiry/:slug` (rate-limited, requires a contact method, scans free text, acknowledgement email); rejects unknown/inactive orgs.
>   - **Admin funnel:** `GET /api/admissions` (list + per-stage counts), `PATCH /:id/stage` (reviewing/accepted/rejected + decision note → applicant email + audit), `POST /:id/convert` (creates the Student in a class, auto-roll-number, links the admission, optional guardian parent-invitation with join-link email + audit).
>   - **Frontend:** public `/apply/:slug` form with a thank-you state; admin **Admissions** funnel + **Convert** modal; sidebar link.
>   - **Tests green:** `npm test` → **5 suites, 47 passing** (+8 Phase 3: enquiry accept/unknown-org/missing-contact/flagged-content; list+counts+stage+auth guard+invalid-stage; convert creates student/links/parent-invite and rejects a bad class). `cleanDatabase` extended for `admission`. `cd client && npx vite build` succeeds.
>
> **Follow-ups deferred (not blockers):** no document/file uploads on the enquiry yet (text only); no in-app notification for admins on a new enquiry (applicant emails only); enquiry form isn't linked from a public marketing page (share the `/apply/:slug` link directly); duplicate-enquiry detection not implemented.

---

## Phase 4 — Analytics & Insight — ✅ DONE (2026-07-09)
- **Goal:** turn the data you already store into decisions.
- **Deliverables:** ✅ dashboards for attendance trends, grade distribution, at-risk-student flags, and a content-safety/approvals summary; ✅ CSV export. Super-admin platform stats already exist on the Super Admin dashboard (unchanged).
- **Data model:** none — pure aggregation queries. ✅
- **Backend:** `analytics.controller` with admin-only, org-scoped endpoints (`overview`, `attendance-trend`, `grade-distribution`, `at-risk`, `export/students.csv`). ✅
- **Frontend:** admin **Analytics** page with charts drawn in **plain CSS/SVG — no external chart library or CDN**. ✅
- **Reuses:** all existing domain data (attendance, marks, exams, admissions, content-safety); role scoping.
- **Dependencies:** Phases 1–3 enrich the data but aren't blocking.
- **Effort:** M.
- **Exit criterion:** an admin sees attendance and grade-distribution charts and can export a class report; at-risk students are flagged. ✅ **met** (integration-tested).

> **Progress log**
> - 2026-07-09: **Completed Phase 4.** No new tables — all aggregation.
>   - **Endpoints (admin-only, org-scoped):** `overview` (student/teacher/class counts, overall attendance rate, exam-approval + admissions breakdowns, unresolved content-safety count); `attendance-trend` (monthly rate for the last N months, present+late counted as attended); `grade-distribution` (approved-exam percentages bucketed + average-by-subject); `at-risk` (students under 75% attendance — min 5 days — and/or under 40% average, with reasons, worst first); `export/students.csv` (streamed CSV with proper escaping).
>   - **Frontend:** `Analytics` page — stat cards, attendance-trend and grade-distribution bar charts, subject-average bars, at-risk table, and an authenticated CSV download (blob). All charts hand-drawn with CSS/SVG (no dependency added). Sidebar **Analytics** link + `/admin/analytics` route.
>   - **Tests green:** `npm test` → **6 suites, 53 passing** (+6 Phase 4: overview counts/rate, trend totals, grade buckets + subject average, at-risk flags the struggling student but not the strong one, CSV shape, non-admin denial). `cd client && npx vite build` succeeds.
>
> **Follow-ups deferred (not blockers):** no PDF export (CSV only); no per-class / date-range filters on the charts yet; at-risk thresholds are fixed constants (not configurable); metrics computed on the fly (fine at current scale — revisit with materialized summaries if orgs get very large).

---

## Phase 5 — Depth & Parity — ✅ DONE (2026-07-09)
- **Goal:** match competitor breadth on two commonly-expected modules.
- **Deliverables:**
  - ✅ **Library circulation:** issue/return, due dates, per-day fines, per-student borrowing history, on top of the existing book catalog.
  - ✅ **Timetable auto-generation:** lays a class's subjects across a day×period grid into the existing `ClassScheduleSlot` model, assigning matching teachers and validated by the current `findTeacherConflict` collision detection.
- **Data model:** `BookLoan` (book_id, student_id, issued_at, due_date, returned_at, fine, fine_paid) + `Book.total_copies` — modeled as a **loan against the catalog title with a copy count** rather than a separate `BookCopy` table (simpler; availability = total_copies − active loans). No new schedule models (reuse existing slots). ✅ migrated (`…_add_library_and_timetable`).
- **Backend:** `library.controller` (issue/return/pay-fine/list/my-loans); `generateTimetable` added to the schedule controller feeding the existing validators. ✅
- **Frontend:** **Library** circulation desk (issue form, status tabs, return/mark-paid, summary); **Auto-generate** button + modal on Class Schedules (start time / period length / periods-per-day / replace, surfaces unassigned-teacher warnings). ✅
- **Reuses:** book catalog, `teacherConflict`/schedule collision detection, `ClassScheduleSlot`, students/books lists.
- **Dependencies:** none hard.
- **Effort:** L (timetable solver is the hard part).
- **Exit criterion:** a librarian issues/returns a book with fine tracking; an admin generates a conflict-free timetable that passes existing collision checks. ✅ **met** (integration-tested).

> **Progress log**
> - 2026-07-09: **Completed Phase 5.**
>   - **Library:** `BookLoan` model + `Book.total_copies`; issue (blocks when no copies free or the student already holds the title), return (per-day overdue fine, `FINE_PER_DAY`), pay-fine, list (active/overdue/returned + live overdue days/fine + summary of books-out/overdue/unpaid-fine-total), and student `my-loans`. Admin/teacher circulation desk UI.
>   - **Timetable:** `POST /api/schedules/generate` — round-robins the class's subjects across a Mon–Fri × N-period grid (configurable start/length/count), maps each subject to a class teacher whose `subject` matches, creates slots incrementally, and drops a teacher from a cell (with a warning) when `findTeacherConflict` says they'd be double-booked. Refuses to overwrite an existing timetable without `replace`. Auto-generate modal on the schedule page.
>   - **Tests green:** `npm test` → **7 suites, 61 passing** (+8 Phase 5: issue/no-copies/double-hold, overdue fine + pay, list summary + student my-loans; timetable grid + teacher assignment, replace guard, requires-subjects, duty-collision leaves a warning). `cleanDatabase` extended for `book_loans`. `cd client && npx vite build` succeeds.
>
> **Follow-ups deferred (not blockers):** no physical per-copy tracking (copy count only); timetable subject→teacher mapping is a name-match heuristic (no per-subject teacher assignment model) and it doesn't balance subject frequency or insert breaks/lunch; no room/location constraints in the solver; fine rate is a fixed constant (not configurable per org); no overdue-reminder notifications yet (could hang off Phase 1).

---

## Phase 6 — Scale & Reach
- **Goal:** remove the ceilings on deployment and audience.
- **Deliverables:**
  - **PostgreSQL migration** (Prisma provider swap + tested migration); keep SQLite for local dev.
  - **Mobile PWA** first (installable, offline-tolerant, web-push) before any native investment — fastest path to the phone-first parent audience.
- **Data model:** unchanged (provider migration only).
- **Backend:** DB config/env; connection pooling; migration scripts + rollback test.
- **Frontend:** PWA manifest, service worker, responsive audit, web-push wired to Phase 1 notifications.
- **Reuses:** entire existing schema (Prisma abstracts the provider); Phase 1 notification backbone for push.
- **Dependencies:** Phase 1 (push channel); Phase 0 tests (migration confidence).
- **Effort:** L.
- **Exit criterion:** the app runs on Postgres in a staging deploy with all tests green, and installs as a PWA delivering a push notification.

---

## Phase 7 — Safety & Privacy Moat
*The identity play. Hardest for competitors to copy; aligned with 2025–26 COPPA/FERPA tightening (see analysis §1a).*

- **Goal:** make "safe-by-default, data-you-own" a provable, marketable product identity.
- **Deliverables:**
  - Configurable **per-org wordlists and severity thresholds** for content safety.
  - **Image analysis** for uploads (currently manual-review only) via a pluggable local model, same adapter discipline as the AI chat.
  - **Malware/AV scan** (e.g., ClamAV) in the upload pipeline alongside the text safety gate.
  - Per-org **safety audit report** and parent-visible safety assurances; **data export/backup** self-serve per org (data-ownership proof point).
- **Data model:** `SafetySetting` per org; extend `ContentScanResult` for image verdicts; export job records.
- **Backend:** extend `contentSafety`/`uploadGuard`; AV scan step; image-scan adapter; export/backup routines.
- **Frontend:** safety settings page; safety audit report; export UI.
- **Reuses:** `scanText`/`gateUpload`/`ContentScanResult`; the pluggable-local-adapter pattern; audit log.
- **Dependencies:** Phase 0 (audit log), Phase 4 (report surface).
- **Effort:** L.
- **Exit criterion:** an admin tunes per-org safety rules, uploads are AV- and image-scanned, and the org can export its full dataset and view a safety audit report.

---

## Backlog
*Explicitly deferred — not scheduled into any phase yet. Documented so the phased work above stays compatible with them.*

| Item | Why deferred / notes |
|------|----------------------|
| **Fee management & invoicing** | Parked by request. When scheduled: `FeeStructure`, `FeeItem`, `Invoice` models scoped by `org_id`; admin defines fee heads/schedules; per-student invoices; manual "record payment" first. Fee status on student/parent dashboards. |
| **Online payments / gateway integration** | Follows fee management. Pluggable payment-gateway adapter (Razorpay/Stripe) behind an env flag, same optional-adapter discipline as the AI chat and SMS. Overdue reminders hang off the **Phase 1 notification backbone** — which is why Phase 1 is built first. |
| **Transport / bus routing** | Common in the boarding/emerging-market segment; revisit after core adoption features land. |
| **Hostel / dormitory** | Same segment; lower priority than the table-stakes gaps. |
| **Native mobile app** | Only after the Phase 6 PWA proves demand; native is a large investment. |
| **Two-way messaging / chat threads** | Phase 1 ships one-way notifications; full threaded messaging can follow if demand warrants. |
| **State/government compliance reporting** | Jurisdiction-specific; scope per target market when a concrete customer requires it. |

---

## At-a-Glance Sequence

```
Phase 0  Foundations & Hardening        (M)  ── derisks everything
Phase 1  Communication & Notifications  (L)  ── backbone others hang off
Phase 2  Learning Loop (submit + quiz)  (L)  ── reuses the most existing code
Phase 3  Admissions & Enrollment        (M–L)
Phase 4  Analytics & Insight            (M)
Phase 5  Depth & Parity (library, TT)   (L)
Phase 6  Scale & Reach (Postgres, PWA)  (L)
Phase 7  Safety & Privacy Moat          (L)  ── the identity play
────────────────────────────────────────────
Backlog  Fees, Payments, Transport, Hostel, Native app, 2-way messaging, Compliance reporting
```
