import { describe, expect, it, vi } from "vitest";
import {
  DROPDOWN_LIMIT,
  search,
  searchDocuments,
  searchMembers,
  type SearchDb,
} from "./search";

// search.ts imports the real Prisma client to use as its default argument.
// Stub it so importing the module under test never opens a database client;
// every test passes an explicit fake instead.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

type FindManyArgs = {
  where?: unknown;
  select?: Record<string, boolean>;
  orderBy?: unknown;
  take?: number;
};

function makeDb(members: unknown[] = [], documents: unknown[] = []) {
  const memberFindMany = vi.fn().mockResolvedValue(members);
  const documentFindMany = vi.fn().mockResolvedValue(documents);
  const db = {
    councilMember: { findMany: memberFindMany },
    councilDocument: { findMany: documentFindMany },
  } as unknown as SearchDb;
  return { db, memberFindMany, documentFindMany };
}

function memberArgs(mock: ReturnType<typeof vi.fn>): FindManyArgs {
  return mock.mock.calls[0][0] as FindManyArgs;
}

function documentArgs(mock: ReturnType<typeof vi.fn>): FindManyArgs {
  return mock.mock.calls[0][0] as FindManyArgs;
}

describe("search", () => {
  it("applies DROPDOWN_LIMIT by default to both queries", async () => {
    const { db, memberFindMany, documentFindMany } = makeDb();

    await search("housing", undefined, db);

    expect(memberArgs(memberFindMany).take).toBe(DROPDOWN_LIMIT);
    expect(documentArgs(documentFindMany).take).toBe(DROPDOWN_LIMIT);
  });

  it("forwards an explicit limit to both queries", async () => {
    const { db, memberFindMany, documentFindMany } = makeDb();

    await search("housing", 10, db);

    expect(memberArgs(memberFindMany).take).toBe(10);
    expect(documentArgs(documentFindMany).take).toBe(10);
  });

  it("passes the raw query through without trimming or escaping", async () => {
    const { db, documentFindMany } = makeDb();
    const q = "50% & _transit";

    await search(q, 5, db);

    const where = documentArgs(documentFindMany).where as {
      OR: { title: { contains: string } }[];
    };
    expect(where.OR[0].title.contains).toBe(q);
  });

  it("queries both tables once and returns both result arrays", async () => {
    const members = [{ slug: "a" }];
    const documents = [{ docNumber: "1" }];
    const { db, memberFindMany, documentFindMany } = makeDb(members, documents);

    await expect(search("x", 5, db)).resolves.toEqual({ members, documents });
    expect(memberFindMany).toHaveBeenCalledTimes(1);
    expect(documentFindMany).toHaveBeenCalledTimes(1);
  });

  it("returns empty arrays when nothing matches", async () => {
    const { db } = makeDb();

    await expect(search("x", 5, db)).resolves.toEqual({ members: [], documents: [] });
  });
});

describe("searchMembers", () => {
  it("matches fullName case-insensitively", async () => {
    const { db, memberFindMany } = makeDb();

    await searchMembers("Morillo", 5, db);

    expect(memberArgs(memberFindMany).where).toEqual({
      fullName: { contains: "Morillo", mode: "insensitive" },
    });
  });

  it("selects only the fields the dropdown renders", async () => {
    const { db, memberFindMany } = makeDb();

    await searchMembers("Morillo", 5, db);

    expect(Object.keys(memberArgs(memberFindMany).select ?? {}).sort()).toEqual([
      "district",
      "fullName",
      "governingBody",
      "photoUrl",
      "slug",
    ]);
  });
});

describe("searchDocuments", () => {
  it("matches title, headline, and tags case-insensitively", async () => {
    const { db, documentFindMany } = makeDb();

    await searchDocuments("housing", 5, db);

    expect(documentArgs(documentFindMany).where).toEqual({
      OR: [
        { title: { contains: "housing", mode: "insensitive" } },
        { aiHeadline: { contains: "housing", mode: "insensitive" } },
        { categoryTags: { contains: "housing", mode: "insensitive" } },
      ],
    });
  });

  it("orders newest first and selects only the needed fields", async () => {
    const { db, documentFindMany } = makeDb();

    await searchDocuments("housing", 5, db);

    const args = documentArgs(documentFindMany);
    expect(args.orderBy).toEqual({ voteDate: "desc" });
    expect(Object.keys(args.select ?? {}).sort()).toEqual([
      "aiHeadline",
      "docNumber",
      "governingBody",
      "title",
      "voteDate",
    ]);
  });
});
