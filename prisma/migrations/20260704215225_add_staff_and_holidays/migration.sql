-- CreateTable
CREATE TABLE "staff_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staff_id" TEXT NOT NULL,
    "assignment_type" TEXT NOT NULL,
    "class_id" TEXT,
    "details" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "staff_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "staff_assignments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "end_date" TEXT,
    "description" TEXT,
    "created_by" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "holidays_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "holidays_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
