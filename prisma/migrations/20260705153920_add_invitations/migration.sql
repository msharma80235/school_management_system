-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "subject" TEXT,
    "student_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" DATETIME NOT NULL,
    "accepted_at" DATETIME,
    "created_by" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_code_key" ON "invitations"("code");
