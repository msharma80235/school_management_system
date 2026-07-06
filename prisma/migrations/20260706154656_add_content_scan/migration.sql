-- CreateTable
CREATE TABLE "content_scan_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_path" TEXT,
    "status" TEXT NOT NULL,
    "categories" TEXT,
    "matches" TEXT,
    "note" TEXT,
    "scanned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_by" TEXT,
    "resolved_at" DATETIME,
    "resolution" TEXT,
    "org_id" TEXT NOT NULL,
    CONSTRAINT "content_scan_results_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "content_scan_results_source_type_source_id_key" ON "content_scan_results"("source_type", "source_id");
