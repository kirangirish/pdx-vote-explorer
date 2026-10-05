import { describe, expect, it, vi } from "vitest";
import { search, searchDocuments, searchMembers, type SearchDb } from "./search";

// search.ts imports the real Prisma client as its default argument; stub it so
// importing the module never constructs a database client. Every test passes an
// explicit fake instead.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

function makeDb(members: unknown[] = [], documents: unknown[] = []) {
  const memberFindMany = vi.fn().mockResolvedValue(members);
  const documentFindMany = vi.fn().mockResolvedValue(documents);
  const db = {
    councilMember: { findMany: memberFindMany },
    councilDocument: { findMany: documentFindMany },
  } as unknown as SearchDb;
  return { db, memberFindMany, documentFindMany };
}

describe("search", () => {
  it("matches members by name case-insensitively", async () => {
    const { db, memberFindMany } = makeDb();

    await searchMembers("Morillo", 5, db);

    expect(memberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fullName: { contains: "Morillo", mode: "insensitive" } },
      })
    );
  });

  it("matches documents by title, headline, and tags, newest first", async () => {
    const { db, documentFindMany } = makeDb();

    await searchDocuments("housing", 5, db);

    expect(documentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { title: { contains: "housing", mode: "insensitive" } },
            { aiHeadline: { contains: "housing", mode: "insensitive" } },
            { categoryTags: { contains: "housing", mode: "insensitive" } },
          ],
        },
        orderBy: { voteDate: "desc" },
      })
    );
  });

  it("forwards the limit to both queries and returns both result sets", async () => {
    const members = [{ slug: "a" }];
    const documents = [{ docNumber: "1" }];
    const { db, memberFindMany, documentFindMany } = makeDb(members, documents);

    await expect(search("housing", 10, db)).resolves.toEqual({ members, documents });
    expect(memberFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(documentFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });
});
