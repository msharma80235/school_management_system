-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_homework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "book_id" TEXT,
    "due_date" TEXT NOT NULL,
    "assigned_by" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "homework_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "homework_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "homework_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "homework_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "homework_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_homework" ("assigned_by", "class_id", "created_at", "description", "due_date", "id", "is_active", "org_id", "subject_id", "title", "updated_at") SELECT "assigned_by", "class_id", "created_at", "description", "due_date", "id", "is_active", "org_id", "subject_id", "title", "updated_at" FROM "homework";
DROP TABLE "homework";
ALTER TABLE "new_homework" RENAME TO "homework";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
