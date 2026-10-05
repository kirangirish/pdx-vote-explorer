# Search Results Page — Plan

Status: **PR 1 merged, PR 2 not started**
Goal: submitting the header search goes to `/search?q=...` showing all matches, while the dropdown keeps working. Keep the diff small and matching logic in one testable place.

## Scope

In:
- One shared `search()` function used by both the dropdown API and the results page.
- A `/search` results page (members + documents).
- `SearchBar` submits to `/search` instead of jumping to the first result.

Out (deliberately dropped to keep this small):
- Pagination, result counts, match highlighting, dynamic metadata, in-page search box.
- Matching/ranking changes and database indexes (e.g. trigram).
- An `AbortController` / request-sequencing guard in `SearchBar`.
- Any change to category/vote/sort filters.

## Progress

### PR 1 — Extract `src/lib/search.ts` ✅ Merged

Merged via [PR #12](https://github.com/kirangirish/pdx-vote-explorer/pull/12) (`main` @ `aa9bfe2`). What actually landed:

- `src/lib/search.ts` — `searchMembers`, `searchDocuments`, `search`, with `DROPDOWN_LIMIT = 5` as
  the default limit. The Prisma client is injectable (`db: SearchDb = prisma`) for testing.
- `src/app/api/search/route.ts` — thin wrapper; keeps the `< 2` char guard and calls `search(q)`.
- `src/lib/search.test.ts` (3 tests) + `vitest.config.ts` + `vitest` devDependency.

Deviations from the original plan:
- **DI and tests were originally scoped out**, then added so the matching rules could be tested
  without a database. The tests cover only the regressions that matter: member matching, document
  matching + ordering, and limit forwarding / result shape.
- **The lint fixes were reverted.** `npm run lint` currently fails on two pre-existing errors
  unrelated to search (`src/app/about/page.tsx:49`, `src/components/SearchBar.tsx:36`). PR 2
  touches `SearchBar`, so that one can be fixed there.

### PR 2 — Add `/search` page + submit navigation ⬜ Next

- Bump the `search()` default to `DEFAULT_SEARCH_LIMIT = 10`, and have the API route pass
  `DROPDOWN_LIMIT` explicitly so the dropdown stays at 5.
- Add `src/app/search/page.tsx` (server component):
  - `searchParams: Promise<{ q?: string }>`, `await` it, trim `q`.
  - If `q.length < 2` render a prompt state; else `await search(q)` (uses the 10 default).
  - Render a "Results for '<q>'" heading, a members list using `MemberAvatar`, documents reusing
    `DecisionsList` (pass no `categoryHref` so tags are plain labels), and a no-matches state.
- Edit `src/components/SearchBar.tsx`:
  - Wrap the input in a `<form>`; on submit `router.push('/search?q=' + encodeURIComponent(query.trim()))`.
  - Enter now submits (goes to `/search`) instead of selecting the first result.
  - Add a "View all results" footer row in the dropdown that submits.
  - Keep row clicks, debounce, 2-char gate, and outside/Escape close as-is.
- Acceptance: Enter and "View all results" land on `/search?q=...` with correct encoding; row
  clicks still jump directly; `/search` with no/short `q` and with no matches are clean states.

## Verification

- `npm test` (Vitest; currently 3 passing tests for `search.ts`).
- `npm run lint` and `npm run build` — note lint is currently red on the two pre-existing errors.
- Manual: no query, 1 char, 2 chars, multi-word, symbols (`&`,`#`,`%`), a members-only match, a
  documents-only match, and a no-match query — via Enter, via "View all results", and by loading
  `/search?q=...` directly.
