// Help agent for Education Hub. By default it is fully rule-based — every
// question runs through a fixed pipeline of predefined steps and answers come
// only from the curated knowledge base below.
//
// Optionally, a LOCAL AI agent can be plugged in via the CHAT_AGENT_CMD env
// variable (see README "Plugging in an AI agent"). The pipeline still wraps
// it on both sides: the security filter and scope check run BEFORE the AI is
// asked anything, and its reply is kid-safety-scanned and redacted AFTER —
// with automatic fallback to the knowledge base if the AI is unavailable or
// its answer fails the safety scan. .env is gitignored, so a configured
// agent never leaves the developer's machine.
//
// Pipeline (always executed in this order, before any answer is produced):
//   1. sanitize          — normalize and bound the input
//   2. security_filter   — block questions asking for secrets/credentials
//   3. scope_check       — only questions about this project pass
//   4. ai_agent          — optional: ask the configured local AI agent
//   5. knowledge_lookup  — keyword-scored match against the knowledge base
//                          (fallback when no AI is configured / it fails)
//   6. answer_redaction  — scrub anything secret-shaped from the reply

import { execFile } from 'child_process';
import { scanText as safetyScan } from './contentSafety';

export interface PipelineStep {
  step: string;
  status: 'passed' | 'blocked' | 'matched' | 'no_match' | 'clean' | 'redacted';
  detail: string;
}

export interface ChatResult {
  answer: string;
  topic: string | null;
  suggestions: string[];
  steps: PipelineStep[];
  source: 'knowledge_base' | 'ai_agent' | 'pipeline';
}

interface KBEntry {
  topic: string;
  keywords: string[];   // scored for matching
  question: string;     // shown as a suggestion
  answer: string;
}

// ---------- Knowledge base (the only source of answers) ----------
const KNOWLEDGE_BASE: KBEntry[] = [
  {
    topic: 'about',
    keywords: ['what', 'education', 'hub', 'project', 'about', 'platform', 'app', 'system', 'does'],
    question: 'What is Education Hub?',
    answer: 'Education Hub is a multi-tenant school management platform. Each school (organization) gets its own isolated space with role-based logins for admins, teachers, students, parents, volunteers, and administrative staff, while a platform super admin oversees all organizations.',
  },
  {
    topic: 'login',
    keywords: ['login', 'log', 'sign', 'signin', 'portal', 'access', 'enter'],
    question: 'How do I log in?',
    answer: 'Staff (admin/teacher/volunteer/staff) log in at /login with their email, password, and organization ID. Parents and students use /parent-login. The platform super admin uses /super-login. If you have an invitation code, join at /join.',
  },
  {
    topic: 'roles',
    keywords: ['role', 'roles', 'permission', 'permissions', 'who', 'can', 'admin', 'teacher', 'volunteer', 'staff', 'duties'],
    question: 'What roles exist and what can they do?',
    answer: 'Roles: Admin (manages everything in their org), Teacher (assigned classes: marks, homework, attendance), Parent (their children\'s details and reports), Student (own dashboard), Volunteer (read-only marks/homework, can record attendance), Admin Staff (customizable duty assignments), and platform Super Admin (manages organizations). The full duties document is on the Documents page under Roles & Duties.',
  },
  {
    topic: 'invites',
    keywords: ['invite', 'invitation', 'register', 'registration', 'join', 'code', 'signup', 'onboard', 'new', 'account', 'create'],
    question: 'How do new users register?',
    answer: 'Registration is invite-only. An admin creates invitation codes (Invitations page) for teachers, students, parents, volunteers, or staff — optionally locked to an email. The invitee opens /join, enters the code, sets a password, and is logged in automatically. Codes are single-use and expire after 7 days.',
  },
  {
    topic: 'classes',
    keywords: ['class', 'classes', 'section', 'grade', 'level', 'add', 'custom'],
    question: 'How are classes and grade levels managed?',
    answer: 'Admins define grade levels (standard Class 1-12 or fully custom names) under Grade Levels, then create classes with optional sections under Classes. Multiple teachers can be assigned to the same class (co-teaching). Teachers only see the classes assigned to them.',
  },
  {
    topic: 'students',
    keywords: ['student', 'students', 'enroll', 'roll', 'transfer', 'photo', 'picture', 'image'],
    question: 'How do I manage students?',
    answer: 'Admins add students to a class from the class\'s student list (name, roll number, DOB, guardian info). Students can be transferred between classes, given login accounts, and can have an optional photo (Photo button on the student row) which prints on their marksheet.',
  },
  {
    topic: 'parents',
    keywords: ['parent', 'parents', 'child', 'children', 'guardian', 'linked'],
    question: 'How do parent accounts work?',
    answer: 'Parents are linked to one or more children — and a student can have multiple linked parents; all of them appear as clickable links in the student table leading to a parent detail page. Parents log in at /parent-login to see each child\'s details, attendance, report cards, books, and class schedule. Parents with no active enrolled student are greyed out with a tag.',
  },
  {
    topic: 'attendance',
    keywords: ['attendance', 'present', 'absent', 'late', 'mark'],
    question: 'How is attendance recorded?',
    answer: 'Admins, teachers, and volunteers record student attendance per class and date on the Attendance page. Volunteer attendance is recorded by admins/teachers; volunteers can view (but not change) their own record. Parents see their child\'s attendance summary on their dashboard.',
  },
  {
    topic: 'exams',
    keywords: ['exam', 'exams', 'test', 'marks', 'quiz', 'subjective', 'question', 'paper', 'generate', 'file', 'pdf', 'upload'],
    question: 'How do exams and marks work?',
    answer: 'Teachers/admins create exams per class and subject (mid-term/final oral & written, class tests, projects) on Exams & Marks. You can also Create from File: upload a PDF and generate a gradable Quiz (MCQ/fill-blank/true-false with an answer key) or a Subjective Test — questions are generated in the document\'s own language, and the paper can be viewed in-app or downloaded as a PDF.',
  },
  {
    topic: 'approval',
    keywords: ['approval', 'approve', 'submit', 'reject', 'workflow', 'pending', 'review'],
    question: 'What is the marks approval workflow?',
    answer: 'After entering marks, the teacher submits the exam for approval. The admin reviews the actual entries on the Approvals page and approves or rejects with a note. Report cards can only be generated once every exam in the class is approved.',
  },
  {
    topic: 'reportcards',
    keywords: ['report', 'card', 'marksheet', 'grade', 'print', 'download', 'customize', 'logo'],
    question: 'How do report cards work?',
    answer: 'Report Cards shows a formatted, color marksheet per student: org logo, optional student photo, per-subject marks across exam types, percentages, grades, attendance, and remarks. It is customizable (institute details, grading scale, show/hide toggles) and downloads as a color PDF. Requires all class exams to be approved first.',
  },
  {
    topic: 'homework',
    keywords: ['homework', 'assignment', 'assign', 'due'],
    question: 'How is homework assigned?',
    answer: 'Teachers and admins create homework per class and subject with a due date on the Homework page, optionally attaching an approved book from the library. Students and parents see homework on their dashboards; volunteers can view it read-only.',
  },
  {
    topic: 'books',
    keywords: ['book', 'books', 'library', 'scan', 'copy', 'category'],
    question: 'How does the book library work?',
    answer: 'Books are managed per subject/class (including custom categories) on the Books page, with optional PDF or scanned copies (up to 25MB). Books uploaded by non-moderators need moderator approval before others can see them or attach them to homework. Students and parents see their class\'s approved books.',
  },
  {
    topic: 'content_safety',
    keywords: ['safety', 'inappropriate', 'adult', 'profanity', 'vulgar', 'scan', 'blocked', 'flag', 'flagged', 'kids'],
    question: 'How is inappropriate content handled?',
    answer: 'Two layers protect students: (1) every upload is scanned before it is accepted — files, titles, or exam questions containing adult content or profanity are rejected outright and never enter the system; (2) the admin-only Content Safety page re-scans everything already in the org, flags issues by category, queues images for manual review, and lets admins mark items safe.',
  },
  {
    topic: 'moderation',
    keywords: ['moderation', 'moderator', 'approve', 'content', 'queue', 'pending', 'review'],
    question: 'What is content moderation?',
    answer: 'Admins can make any number of users moderators (Users page → Make Moderator). Books and school documents uploaded by non-moderators stay pending — visible only to the uploader — until a moderator or admin approves them from the Moderation page. Rejections include a note, and editing a rejected item resubmits it.',
  },
  {
    topic: 'documents',
    keywords: ['document', 'documents', 'notice', 'circular', 'schedule', 'event', 'share'],
    question: 'How are school documents shared?',
    answer: 'Admins upload documents (schedules, events, notices, circulars) on the Documents page and choose the audience roles. Teachers and staff can submit documents too, which go through moderator approval. Everyone in the chosen audience sees approved documents read-only.',
  },
  {
    topic: 'schedules',
    keywords: ['schedule', 'timetable', 'period', 'slot', 'teacher', 'duty', 'meeting', 'clash', 'collision'],
    question: 'How do class and teacher schedules work?',
    answer: 'Admins build a weekly timetable per class (Class Schedules): periods with subjects or custom slots like Assembly/Lunch, plus rooms. Each period can be assigned a teacher, and admins add duties/meetings per teacher (Teacher Schedules). Collisions are always blocked — a teacher can never be double-booked. Teachers see their week under My Schedule.',
  },
  {
    topic: 'calendar',
    keywords: ['calendar', 'holiday', 'holidays', 'month', 'day', 'break'],
    question: 'What does the school calendar show?',
    answer: 'The Calendar shows admin-managed holidays (read-only for everyone else) with a schedule overlay: pick a class or teacher and its periods appear on each weekday; clicking a date lists that day\'s timetable. Holidays automatically suppress classes for that day.',
  },
  {
    topic: 'users',
    keywords: ['user', 'users', 'deactivate', 'activate', 'lock', 'unlock', 'reset', 'password', 'manage', 'account'],
    question: 'How does user management work?',
    answer: 'The admin\'s Users page lists every account in the organization with search, filters, and sorting. Admins can activate/deactivate, lock/unlock, reset passwords, and assign moderators. Deactivating or locking takes effect immediately — existing sessions are cut off on the next request. The last usable admin can never be locked out.',
  },
  {
    topic: 'superadmin',
    keywords: ['super', 'superadmin', 'organization', 'org', 'disable', 'enable', 'platform'],
    question: 'What can the super admin do?',
    answer: 'The platform super admin (at /super-login) sits above all organizations: platform statistics, enabling/disabling entire orgs (all their users are locked out instantly), and creating, editing, or resetting each org\'s admin accounts.',
  },
  {
    topic: 'orgs',
    keywords: ['organization', 'org', 'school', 'onboard', 'multi', 'tenant', 'slug', 'new'],
    question: 'How do I onboard a new school?',
    answer: 'Use /register to create a new organization with its first admin account. Each org gets a unique slug used at login, and its data (users, classes, marks, documents) is fully isolated from other organizations.',
  },
  {
    topic: 'tech',
    keywords: ['tech', 'stack', 'built', 'technology', 'backend', 'frontend', 'database', 'run', 'start', 'install', 'setup', 'port'],
    question: 'What is the tech stack and how do I run it?',
    answer: 'Backend: Node.js + Express 5 + TypeScript with Prisma ORM on SQLite (port 3000). Frontend: React 18 + Vite + Tailwind CSS (port 5173). Run "npm install", "npx prisma migrate dev", "npm run seed:mock" for sample data, then "npm run dev" (backend) and "npm run dev" inside client/ (frontend). See README.md for details.',
  },
  {
    topic: 'help',
    keywords: ['help', 'hi', 'hello', 'hey', 'start', 'guide', 'faq'],
    question: 'What can you help with?',
    answer: 'I answer questions about Education Hub only — logins, roles, classes, students, parents, attendance, exams, marks approval, report cards, homework, books, moderation, documents, schedules, the calendar, user management, and setup. Ask me anything about those!',
  },
];

// ---------- Step 2: security filter ----------
// Questions probing for secrets/credentials are refused outright.
const SENSITIVE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(password|passwd|pwd)s?\b.*\b(what|show|tell|give|list|share|reveal|of|for)\b|\b(what|show|tell|give|list|share|reveal)\b.*\b(password|passwd|pwd)s?\b/i, label: 'password disclosure' },
  { re: /\b(jwt|token|secret|api.?key|private.?key|credential)s?\b/i, label: 'secrets/tokens' },
  { re: /\.env\b|env\s*(file|var)/i, label: 'environment variables' },
  { re: /\b(hash|bcrypt|salt)\b/i, label: 'password hashes' },
  { re: /\b(database|db|sqlite)\b.*\b(dump|contents?|export|download|read|rows?)\b|\b(dump|export|extract|read)\b.*\b(database|db|sqlite|tables?)\b/i, label: 'database contents' },
  { re: /\b(other|another|someone|all)\b.*\b(users?|students?|parents?)\b.*\b(email|phone|address|dob|birth|detail)/i, label: 'other users\' personal data' },
];

// ---------- Step 3: scope vocabulary ----------
const PROJECT_VOCAB = new Set([
  'education', 'hub', 'project', 'app', 'platform', 'system', 'school', 'org', 'organization',
  'login', 'logout', 'signin', 'portal', 'register', 'invite', 'invitation', 'join', 'code',
  'admin', 'teacher', 'student', 'parent', 'volunteer', 'staff', 'superadmin', 'super', 'moderator', 'role', 'roles', 'user', 'users', 'account',
  'class', 'classes', 'section', 'grade', 'level', 'subject', 'subjects',
  'exam', 'exams', 'quiz', 'marks', 'marksheet', 'test', 'paper', 'question', 'approval', 'approve', 'grading',
  'report', 'card', 'cards', 'attendance', 'homework', 'book', 'books', 'library',
  'document', 'documents', 'notice', 'upload', 'uploads', 'uploaded', 'moderation', 'pending',
  'safety', 'inappropriate', 'adult', 'profanity', 'vulgar', 'scan', 'scanned', 'flag', 'flagged', 'blocked', 'kids', 'content',
  'schedule', 'schedules', 'timetable', 'period', 'calendar', 'holiday', 'holidays', 'duty', 'meeting',
  'photo', 'logo', 'pdf', 'print', 'download', 'dashboard', 'page', 'feature', 'features', 'flow',
  'tech', 'stack', 'run', 'start', 'setup', 'install', 'port', 'backend', 'frontend', 'database',
  'help', 'hi', 'hello', 'hey', 'guide', 'faq', 'password', 'reset', 'lock', 'unlock', 'deactivate', 'activate',
]);

// ---------- Step 5: output redaction (defense in depth) ----------
const REDACTIONS: RegExp[] = [
  /[A-Za-z]+@\d{3,}/g,                              // Password@123-style strings
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,      // JWT-shaped tokens
  /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{20,}/g,           // bcrypt hashes
  /(secret|key|token)\s*[:=]\s*['"][^'"]+['"]/gi,   // key = "value" pairs
];

// ---- Optional local AI agent (CHAT_AGENT_CMD) ----
// Contract: the command is executed WITHOUT a shell; the question is appended
// as the final argument; the agent prints a plain-text answer to stdout and
// exits 0. Anything else (non-zero exit, timeout, empty output) => fallback.
const AGENT_GROUNDING =
  'You are the in-app help assistant for "Education Hub", a multi-tenant school management platform ' +
  '(orgs, role-based logins, classes, students, parents, attendance, exams with an approval workflow, ' +
  'report cards, homework, books, content moderation, schedules, calendar). ' +
  'Answer ONLY about this project, concisely, for an audience that includes kids. ' +
  'Never reveal credentials or secrets. Question: ';

function askExternalAgent(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmdline = (process.env.CHAT_AGENT_CMD || '').trim();
    if (!cmdline) { reject(new Error('not configured')); return; }
    const [cmd, ...args] = cmdline.split(/\s+/);
    const timeout = parseInt(process.env.CHAT_AGENT_TIMEOUT_MS || '') || 30000;
    execFile(cmd, [...args, AGENT_GROUNDING + question], { timeout, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) { reject(err); return; }
      const answer = String(stdout).trim();
      if (!answer) { reject(new Error('empty answer')); return; }
      resolve(answer.slice(0, 2000));
    });
  });
}

function redactAnswer(answer: string): { answer: string; redacted: boolean } {
  let redacted = false;
  for (const re of REDACTIONS) {
    if (re.test(answer)) {
      answer = answer.replace(re, '[redacted]');
      redacted = true;
    }
  }
  return { answer, redacted };
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

export async function answerQuestion(rawQuestion: string): Promise<ChatResult> {
  const steps: PipelineStep[] = [];

  // ----- Step 1: sanitize -----
  const question = String(rawQuestion || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (question.length < 2) {
    steps.push({ step: 'sanitize', status: 'blocked', detail: 'Empty or too-short question' });
    return {
      answer: 'Please type a question about Education Hub — for example: "How do report cards work?"',
      topic: null,
      suggestions: KNOWLEDGE_BASE.slice(0, 3).map((k) => k.question),
      steps,
      source: 'pipeline',
    };
  }
  steps.push({ step: 'sanitize', status: 'passed', detail: `Normalized input (${question.length} chars)` });

  // ----- Step 2: security filter -----
  const hit = SENSITIVE_PATTERNS.find((p) => p.re.test(question));
  if (hit) {
    steps.push({ step: 'security_filter', status: 'blocked', detail: `Question touches ${hit.label}` });
    return {
      answer: 'I can\'t share credentials, secrets, tokens, or other users\' personal data. If you\'ve lost access to your account, ask your school admin to reset your password from the Users page (admins: contact the platform super admin).',
      topic: null,
      suggestions: ['How does user management work?', 'How do new users register?'],
      steps,
      source: 'pipeline',
    };
  }
  steps.push({ step: 'security_filter', status: 'passed', detail: 'No sensitive request detected' });

  // ----- Step 3: scope check -----
  const words = tokenize(question);
  const inScope = words.filter((w) => PROJECT_VOCAB.has(w));
  if (inScope.length === 0) {
    steps.push({ step: 'scope_check', status: 'blocked', detail: 'No Education Hub topics recognized' });
    return {
      answer: 'I can only answer questions about the Education Hub project — its features, flows, and how to use it. Try asking about logins, classes, exams, report cards, schedules, or moderation.',
      topic: null,
      suggestions: KNOWLEDGE_BASE.slice(0, 3).map((k) => k.question),
      steps,
      source: 'pipeline',
    };
  }
  steps.push({ step: 'scope_check', status: 'passed', detail: `Recognized project terms: ${[...new Set(inScope)].slice(0, 5).join(', ')}` });

  // Score the knowledge base up front — used for suggestions in both paths
  const scored = KNOWLEDGE_BASE.map((entry) => {
    const score = words.reduce((s, w) => s + (entry.keywords.includes(w) ? 1 : 0), 0);
    return { entry, score };
  }).sort((a, b) => b.score - a.score);
  const related = scored.slice(0, 3).filter((s) => s.score > 0).map((s) => s.entry.question);

  // ----- Step 4 (optional): local AI agent -----
  if ((process.env.CHAT_AGENT_CMD || '').trim()) {
    try {
      const aiAnswer = await askExternalAgent(question);

      // Kid-safety scan the AI's reply before it reaches anyone
      const safety = safetyScan(aiAnswer);
      if (safety.status === 'flagged') {
        steps.push({ step: 'ai_agent', status: 'blocked', detail: 'AI reply failed the kid-safety scan — falling back to the knowledge base' });
      } else {
        const { answer, redacted } = redactAnswer(aiAnswer);
        steps.push({ step: 'ai_agent', status: 'matched', detail: 'Answered by the locally configured AI agent (kid-safety scan passed)' });
        steps.push({ step: 'answer_redaction', status: redacted ? 'redacted' : 'clean', detail: redacted ? 'Secret-shaped content removed from the answer' : 'Answer contains no secret-shaped content' });
        return { answer, topic: null, suggestions: related, steps, source: 'ai_agent' };
      }
    } catch {
      steps.push({ step: 'ai_agent', status: 'no_match', detail: 'Local AI agent unavailable — falling back to the knowledge base' });
    }
  }

  // ----- Step 5: knowledge lookup (keyword scoring) -----
  const best = scored[0].score > 0 ? scored[0] : null;

  if (!best) {
    steps.push({ step: 'knowledge_lookup', status: 'no_match', detail: 'No knowledge-base entry scored above zero' });
    return {
      answer: 'That sounds project-related, but I don\'t have an answer for it in my knowledge base. Try one of the suggested questions, or check README.md for the full feature list.',
      topic: null,
      suggestions: scored.slice(0, 3).map((s) => s.entry.question),
      steps,
      source: 'pipeline',
    };
  }
  steps.push({ step: 'knowledge_lookup', status: 'matched', detail: `Matched topic "${best.entry.topic}" (score ${best.score})` });

  // ----- Step 6: answer redaction -----
  const { answer, redacted } = redactAnswer(best.entry.answer);
  steps.push({ step: 'answer_redaction', status: redacted ? 'redacted' : 'clean', detail: redacted ? 'Secret-shaped content removed from the answer' : 'Answer contains no secret-shaped content' });

  const kbRelated = scored.slice(1, 4).filter((s) => s.score > 0).map((s) => s.entry.question);

  return { answer, topic: best.entry.topic, suggestions: kbRelated, steps, source: 'knowledge_base' };
}
