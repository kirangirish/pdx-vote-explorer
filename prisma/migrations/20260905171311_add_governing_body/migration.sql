-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_council_documents" (
    "doc_number" TEXT NOT NULL PRIMARY KEY,
    "governing_body" TEXT NOT NULL DEFAULT 'portland_council',
    "title" TEXT NOT NULL,
    "vote_date" DATETIME NOT NULL,
    "ai_headline" TEXT,
    "ai_summary" TEXT,
    "category_tags" TEXT,
    "source_url" TEXT
);
INSERT INTO "new_council_documents" ("ai_headline", "ai_summary", "category_tags", "doc_number", "source_url", "title", "vote_date") SELECT "ai_headline", "ai_summary", "category_tags", "doc_number", "source_url", "title", "vote_date" FROM "council_documents";
DROP TABLE "council_documents";
ALTER TABLE "new_council_documents" RENAME TO "council_documents";
CREATE TABLE "new_council_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "governing_body" TEXT NOT NULL DEFAULT 'portland_council',
    "full_name" TEXT NOT NULL,
    "district" INTEGER NOT NULL,
    "photo_url" TEXT,
    "bio_summary" TEXT
);
INSERT INTO "new_council_members" ("bio_summary", "district", "full_name", "id", "photo_url", "slug") SELECT "bio_summary", "district", "full_name", "id", "photo_url", "slug" FROM "council_members";
DROP TABLE "council_members";
ALTER TABLE "new_council_members" RENAME TO "council_members";
CREATE UNIQUE INDEX "council_members_slug_key" ON "council_members"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
