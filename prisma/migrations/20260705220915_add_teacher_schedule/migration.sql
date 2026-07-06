-- CreateTable
CREATE TABLE "teacher_schedule_slots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacher_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teacher_schedule_slots_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "teacher_schedule_slots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_class_schedule_slots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "subject_id" TEXT,
    "title" TEXT,
    "location" TEXT,
    "teacher_id" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "class_schedule_slots_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "class_schedule_slots_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "class_schedule_slots_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "class_schedule_slots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_class_schedule_slots" ("class_id", "created_at", "day_of_week", "end_time", "id", "location", "org_id", "start_time", "subject_id", "title") SELECT "class_id", "created_at", "day_of_week", "end_time", "id", "location", "org_id", "start_time", "subject_id", "title" FROM "class_schedule_slots";
DROP TABLE "class_schedule_slots";
ALTER TABLE "new_class_schedule_slots" RENAME TO "class_schedule_slots";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
