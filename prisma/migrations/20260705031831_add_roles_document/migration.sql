-- CreateTable
CREATE TABLE "roles_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Roles & Responsibilities',
    "sections" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "roles_documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_documents_org_id_key" ON "roles_documents"("org_id");
