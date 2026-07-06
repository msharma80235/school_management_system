-- AlterTable
ALTER TABLE "students" ADD COLUMN "photo_path" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_report_card_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "institute_name" TEXT,
    "institute_logo" TEXT,
    "address_line" TEXT,
    "tagline" TEXT,
    "show_attendance" BOOLEAN NOT NULL DEFAULT true,
    "show_photo" BOOLEAN NOT NULL DEFAULT true,
    "show_grade" BOOLEAN NOT NULL DEFAULT true,
    "show_percentage" BOOLEAN NOT NULL DEFAULT true,
    "show_rank" BOOLEAN NOT NULL DEFAULT false,
    "show_remarks" BOOLEAN NOT NULL DEFAULT true,
    "principal_name" TEXT,
    "grading_system" TEXT NOT NULL DEFAULT '[{"min":90,"max":100,"grade":"A+","remark":"Outstanding"},{"min":80,"max":89,"grade":"A","remark":"Excellent"},{"min":70,"max":79,"grade":"B+","remark":"Very Good"},{"min":60,"max":69,"grade":"B","remark":"Good"},{"min":50,"max":59,"grade":"C","remark":"Satisfactory"},{"min":40,"max":49,"grade":"D","remark":"Needs Improvement"},{"min":0,"max":39,"grade":"F","remark":"Fail"}]',
    CONSTRAINT "report_card_config_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_report_card_config" ("address_line", "grading_system", "id", "institute_logo", "institute_name", "org_id", "principal_name", "show_attendance", "show_grade", "show_percentage", "show_rank", "show_remarks", "tagline") SELECT "address_line", "grading_system", "id", "institute_logo", "institute_name", "org_id", "principal_name", "show_attendance", "show_grade", "show_percentage", "show_rank", "show_remarks", "tagline" FROM "report_card_config";
DROP TABLE "report_card_config";
ALTER TABLE "new_report_card_config" RENAME TO "report_card_config";
CREATE UNIQUE INDEX "report_card_config_org_id_key" ON "report_card_config"("org_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
