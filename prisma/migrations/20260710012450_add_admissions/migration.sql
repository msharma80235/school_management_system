-- CreateTable
CREATE TABLE "admissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "date_of_birth" TEXT,
    "gender" TEXT,
    "grade_applying" TEXT,
    "guardian_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'enquiry',
    "decision_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "student_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "admissions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "admissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "admissions_student_id_key" ON "admissions"("student_id");

-- CreateIndex
CREATE INDEX "admissions_org_id_stage_idx" ON "admissions"("org_id", "stage");
