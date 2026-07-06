-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_classes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "classes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_classes" ("academic_year", "created_at", "id", "name", "org_id", "section") SELECT "academic_year", "created_at", "id", "name", "org_id", "section" FROM "classes";
DROP TABLE "classes";
ALTER TABLE "new_classes" RENAME TO "classes";
CREATE UNIQUE INDEX "classes_name_section_academic_year_org_id_key" ON "classes"("name", "section", "academic_year", "org_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

