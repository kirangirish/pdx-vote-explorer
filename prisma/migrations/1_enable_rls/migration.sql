-- Supabase exposes the public schema through its auto-generated REST API
-- (PostgREST). Enabling RLS with no policies locks these tables to the anon
-- and authenticated roles; the app and scraper connect as `postgres`, which
-- bypasses RLS, so they're unaffected.
ALTER TABLE "council_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "council_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
