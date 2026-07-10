-- AlterTable
ALTER TABLE "content_scan_results" ADD COLUMN "av_status" TEXT;

-- CreateTable
CREATE TABLE "safety_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "extra_terms" TEXT,
    "muted_categories" TEXT,
    "block_review_uploads" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "safety_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "data_exports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "requested_by" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'full',
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "byte_size" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "data_exports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "safety_settings_org_id_key" ON "safety_settings"("org_id");
