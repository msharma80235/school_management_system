-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_students" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "roll_number" TEXT NOT NULL,
    "date_of_birth" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "parent_name" TEXT NOT NULL,
    "parent_phone" TEXT NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "entered_by" TEXT,
    "user_id" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "students_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "students_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_students" ("address", "class_id", "created_at", "date_of_birth", "entered_by", "first_name", "gender", "id", "is_active", "last_name", "org_id", "parent_name", "parent_phone", "roll_number", "updated_at") SELECT "address", "class_id", "created_at", "date_of_birth", "entered_by", "first_name", "gender", "id", "is_active", "last_name", "org_id", "parent_name", "parent_phone", "roll_number", "updated_at" FROM "students";
DROP TABLE "students";
ALTER TABLE "new_students" RENAME TO "students";
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");
CREATE UNIQUE INDEX "students_roll_number_org_id_key" ON "students"("roll_number", "org_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
