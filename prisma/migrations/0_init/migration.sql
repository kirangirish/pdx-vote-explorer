-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "council_members" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "governing_body" TEXT NOT NULL DEFAULT 'portland_council',
    "full_name" TEXT NOT NULL,
    "district" INTEGER NOT NULL,
    "photo_url" TEXT,
    "bio_summary" TEXT,

    CONSTRAINT "council_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "council_documents" (
    "doc_number" TEXT NOT NULL,
    "governing_body" TEXT NOT NULL DEFAULT 'portland_council',
    "title" TEXT NOT NULL,
    "vote_date" TIMESTAMP(3) NOT NULL,
    "ai_headline" TEXT,
    "ai_summary" TEXT,
    "category_tags" TEXT,
    "source_url" TEXT,

    CONSTRAINT "council_documents_pkey" PRIMARY KEY ("doc_number")
);

-- CreateTable
CREATE TABLE "member_votes" (
    "id" TEXT NOT NULL,
    "doc_number" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "vote" TEXT NOT NULL,

    CONSTRAINT "member_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "council_members_slug_key" ON "council_members"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "member_votes_doc_number_member_id_key" ON "member_votes"("doc_number", "member_id");

-- AddForeignKey
ALTER TABLE "member_votes" ADD CONSTRAINT "member_votes_doc_number_fkey" FOREIGN KEY ("doc_number") REFERENCES "council_documents"("doc_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_votes" ADD CONSTRAINT "member_votes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "council_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

