-- CreateTable
CREATE TABLE "book_loans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "book_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "issued_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TEXT NOT NULL,
    "returned_at" DATETIME,
    "fine" REAL NOT NULL DEFAULT 0,
    "fine_paid" BOOLEAN NOT NULL DEFAULT false,
    "issued_by" TEXT,
    "org_id" TEXT NOT NULL,
    CONSTRAINT "book_loans_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "book_loans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "book_loans_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "total_copies" INTEGER NOT NULL DEFAULT 1,
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
INSERT INTO "new_books" ("approval_status", "author", "class_id", "created_at", "custom_category", "edition", "file_path", "id", "is_mandatory", "isbn", "org_id", "publisher", "review_note", "reviewed_at", "reviewed_by", "subject_id", "title", "updated_at", "uploaded_by") SELECT "approval_status", "author", "class_id", "created_at", "custom_category", "edition", "file_path", "id", "is_mandatory", "isbn", "org_id", "publisher", "review_note", "reviewed_at", "reviewed_by", "subject_id", "title", "updated_at", "uploaded_by" FROM "books";
DROP TABLE "books";
ALTER TABLE "new_books" RENAME TO "books";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "book_loans_org_id_returned_at_idx" ON "book_loans"("org_id", "returned_at");
