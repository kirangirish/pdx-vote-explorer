/*
  Warnings:

  - Added the required column `slug` to the `council_members` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_council_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "district" INTEGER NOT NULL,
    "photo_url" TEXT,
    "bio_summary" TEXT
);
INSERT INTO "new_council_members" ("bio_summary", "district", "full_name", "id", "photo_url") SELECT "bio_summary", "district", "full_name", "id", "photo_url" FROM "council_members";
DROP TABLE "council_members";
ALTER TABLE "new_council_members" RENAME TO "council_members";
CREATE UNIQUE INDEX "council_members_slug_key" ON "council_members"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
