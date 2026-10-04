# Search Results Page — Minimal Plan

Status: proposed
Goal: submitting the header search goes to `/search?q=...` showing all matches, while the dropdown keeps working. Keep the diff small and matching logic in one testable place.

## Scope

In:
- One shared `search()` function used by both the dropdown API and the new page.
- A `/search` results page (members + documents).
- SearchBar submits to `/search` instead of jumping to the first result.

Out (deliberately dropped to keep this small):
- Pagination, result counts, match highlighting, dynamic metadata, in-page search box.
- Matching/ranking changes, indexes, `AbortController`, dependency injection.
- Any change to category/vote/sort filters or the dropdown's 5-result cap.

## Design

One new lib file, one new page, two small edits.

```ts
// src/lib/search.ts
import { prisma } from "@/lib/prisma";

export const DROPDOWN_LIMIT = 5; // header dropdown only: quick jumps
// Default for the results page / any generic caller.
export const DEFAULT_SEARCH_LIMIT = 10;

export function searchMembers(q: string, limit = DEFAULT_SEARCH_LIMIT) {
  return prisma.councilMember.findMany({
    where: { fullName: { contains: q, mode: "insensitive" } },
    select: { slug: true, fullName: true, photoUrl: true, district: true, governingBody: true },
    take: limit,
  });
}

export function searchDocuments(q: string, limit = DEFAULT_SEARCH_LIMIT) {
  return prisma.councilDocument.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { aiHeadline: { contains: q, mode: "insensitive" } },
        { categoryTags: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { docNumber: true, title: true, aiHeadline: true, governingBody: true, voteDate: true },
    orderBy: { voteDate: "desc" },
    take: limit,
  });
}

export async function search(q: string, limit = DEFAULT_SEARCH_LIMIT) {
  const [members, documents] = await Promise.all([
    searchMembers(q, limit),
    searchDocuments(q, limit),
  ]);
  return { members, documents };
}
```

The only "abstraction" win is that the matching rules now live in named functions outside the route handler, where they can be unit-tested later. No DI/refactor beyond that.

## PR 1 — Extract `src/lib/search.ts` (refactor, no behavior change)

- Add `src/lib/search.ts` with the same queries, but default `limit = DROPDOWN_LIMIT` (5) for
  now, so this PR is a strict no-op. PR 2 introduces `DEFAULT_SEARCH_LIMIT = 10`.
- Edit `src/app/api/search/route.ts` to call `search(q)` (uses the 5 default); keep the `< 2`
  char guard.
- Acceptance: `GET /api/search?q=...` returns identical JSON; dropdown unchanged.

## PR 2 — Add `/search` page + submit navigation

- Bump the `search()` default to `DEFAULT_SEARCH_LIMIT = 10`, and have the API route pass
  `DROPDOWN_LIMIT` explicitly so the dropdown stays at 5.
- Add `src/app/search/page.tsx` (server component):
  - `searchParams: Promise<{ q?: string }>`, `await` it, trim `q`.
  - If `q.length < 2` render a prompt state; else `await search(q)` (uses the 10 default).
  - Render a "Results for '<q>'" heading, a members list using `MemberAvatar`, documents reusing
    `DecisionsList` (no `categoryHref`), and a no-matches state.
- Edit `src/components/SearchBar.tsx`:
  - Wrap input in a `<form>`; on submit `router.push('/search?q=' + encodeURIComponent(query.trim()))`.
  - Enter now submits (goes to `/search`) instead of selecting the first result.
  - Add a "View all results" footer row in the dropdown that submits.
  - Keep row clicks, debounce, 2-char gate, and outside/Escape close as-is.
- Acceptance: Enter and "View all results" land on `/search?q=...` with correct encoding; row
  clicks still jump directly; `/search` with no/short `q` and with no matches are clean states.

PRs 1 and 2 are each small; they can be merged together if preferred.

## Verification

- `npm run lint` and `npm run build`.
- Manual: no query, 1 char, 2 chars, multi-word, symbols (`&`,`#`,`%`), a members-only match, a
  documents-only match, and a no-match query — via Enter, via "View all results", and by loading
  `/search?q=...` directly.
