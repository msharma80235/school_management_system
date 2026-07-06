-- AlterTable
ALTER TABLE "exams" ADD COLUMN "exam_format" TEXT;

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exam_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "question_type" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" TEXT,
    "correct_answer" TEXT,
    "marks" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "exam_questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
