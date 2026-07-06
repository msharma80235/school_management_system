-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subjects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "class_subjects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    CONSTRAINT "class_subjects_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "class_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "exam_type" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "max_marks" INTEGER NOT NULL,
    "exam_date" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exams_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "exams_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "exams_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "marks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "marks_obtained" REAL NOT NULL,
    "remarks" TEXT,
    "entered_by" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "marks_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "marks_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "marks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "report_card_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "institute_name" TEXT,
    "institute_logo" TEXT,
    "address_line" TEXT,
    "tagline" TEXT,
    "show_attendance" BOOLEAN NOT NULL DEFAULT true,
    "show_grade" BOOLEAN NOT NULL DEFAULT true,
    "show_percentage" BOOLEAN NOT NULL DEFAULT true,
    "show_rank" BOOLEAN NOT NULL DEFAULT false,
    "show_remarks" BOOLEAN NOT NULL DEFAULT true,
    "principal_name" TEXT,
    "grading_system" TEXT NOT NULL DEFAULT '[{"min":90,"max":100,"grade":"A+","remark":"Outstanding"},{"min":80,"max":89,"grade":"A","remark":"Excellent"},{"min":70,"max":79,"grade":"B+","remark":"Very Good"},{"min":60,"max":69,"grade":"B","remark":"Good"},{"min":50,"max":59,"grade":"C","remark":"Satisfactory"},{"min":40,"max":49,"grade":"D","remark":"Needs Improvement"},{"min":0,"max":39,"grade":"F","remark":"Fail"}]',
    CONSTRAINT "report_card_config_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_org_id_key" ON "subjects"("code", "org_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_subjects_class_id_subject_id_key" ON "class_subjects"("class_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "marks_student_id_exam_id_key" ON "marks"("student_id", "exam_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_card_config_org_id_key" ON "report_card_config"("org_id");
