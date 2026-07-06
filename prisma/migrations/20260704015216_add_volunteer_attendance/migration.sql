-- CreateTable
CREATE TABLE "volunteer_attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "volunteer_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "remarks" TEXT,
    "marked_by" TEXT,
    "org_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "volunteer_attendance_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "volunteer_attendance_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "volunteer_attendance_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_attendance_volunteer_id_date_key" ON "volunteer_attendance"("volunteer_id", "date");
