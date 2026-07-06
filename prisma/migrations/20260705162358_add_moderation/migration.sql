-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_books" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "isbn" TEXT,
    "publisher" TEXT,
    "edition" TEXT,
    "subject_id" TEXT,
    "custom_category" TEXT,
    "class_id" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "file_path" TEXT,
    "approval_status" TEXT NOT NULL DEFAULT 'approved',
    "uploaded_by" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "review_note" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "books_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "books_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "books_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "books_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "books_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_books" ("author", "class_id", "created_at", "custom_category", "edition", "file_path", "id", "is_mandatory", "isbn", "org_id", "publisher", "subject_id", "title", "updated_at") SELECT "author", "class_id", "created_at", "custom_category", "edition", "file_path", "id", "is_mandatory", "isbn", "org_id", "publisher", "subject_id", "title", "updated_at" FROM "books";
DROP TABLE "books";
ALTER TABLE "new_books" RENAME TO "books";
CREATE TABLE "new_school_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "file_path" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'teacher,student,parent,volunteer',
    "approval_status" TEXT NOT NULL DEFAULT 'approved',
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "review_note" TEXT,
    "uploaded_by" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "school_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "school_documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_school_documents" ("audience", "category", "created_at", "description", "file_path", "id", "org_id", "title", "uploaded_by") SELECT "audience", "category", "created_at", "description", "file_path", "id", "org_id", "title", "uploaded_by" FROM "school_documents";
DROP TABLE "school_documents";
ALTER TABLE "new_school_documents" RENAME TO "school_documents";
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'teacher',
    "subject" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "is_moderator" BOOLEAN NOT NULL DEFAULT false,
    "org_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("created_at", "email", "id", "is_active", "is_locked", "name", "org_id", "password", "role", "subject", "updated_at") SELECT "created_at", "email", "id", "is_active", "is_locked", "name", "org_id", "password", "role", "subject", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_org_id_key" ON "users"("email", "org_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
