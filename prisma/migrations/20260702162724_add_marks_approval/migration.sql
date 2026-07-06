-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_exams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "exam_type" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "max_marks" INTEGER NOT NULL,
    "exam_date" TEXT,
    "approval_status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" DATETIME,
    "approved_at" DATETIME,
    "rejection_note" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exams_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "exams_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "exams_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_exams" ("class_id", "created_at", "exam_date", "exam_type", "id", "max_marks", "name", "org_id", "subject_id", "term") SELECT "class_id", "created_at", "exam_date", "exam_type", "id", "max_marks", "name", "org_id", "subject_id", "term" FROM "exams";
DROP TABLE "exams";
ALTER TABLE "new_exams" RENAME TO "exams";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
