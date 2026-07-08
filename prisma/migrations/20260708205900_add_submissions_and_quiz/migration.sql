-- AlterTable
ALTER TABLE "exams" ADD COLUMN "time_limit_min" INTEGER;

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "homework_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "file_path" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "grade" REAL,
    "max_grade" REAL,
    "feedback" TEXT,
    "graded_by" TEXT,
    "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graded_at" DATETIME,
    "org_id" TEXT NOT NULL,
    CONSTRAINT "submissions_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homework" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "submissions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exam_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" DATETIME,
    "score" REAL,
    "max_score" REAL,
    "org_id" TEXT NOT NULL,
    CONSTRAINT "quiz_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quiz_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quiz_attempts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quiz_responses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer" TEXT,
    "is_correct" BOOLEAN,
    "awarded" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "quiz_responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quiz_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exam_questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "submissions_homework_id_student_id_key" ON "submissions"("homework_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempts_exam_id_student_id_key" ON "quiz_attempts"("exam_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_responses_attempt_id_question_id_key" ON "quiz_responses"("attempt_id", "question_id");
