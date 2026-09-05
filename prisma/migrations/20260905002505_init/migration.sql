-- CreateTable
CREATE TABLE "council_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "full_name" TEXT NOT NULL,
    "district" INTEGER NOT NULL,
    "photo_url" TEXT,
    "bio_summary" TEXT
);

-- CreateTable
CREATE TABLE "council_documents" (
    "doc_number" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "vote_date" DATETIME NOT NULL,
    "ai_headline" TEXT,
    "ai_summary" TEXT,
    "category_tags" TEXT
);

-- CreateTable
CREATE TABLE "member_votes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_number" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    CONSTRAINT "member_votes_doc_number_fkey" FOREIGN KEY ("doc_number") REFERENCES "council_documents" ("doc_number") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "member_votes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "council_members" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "member_votes_doc_number_member_id_key" ON "member_votes"("doc_number", "member_id");
