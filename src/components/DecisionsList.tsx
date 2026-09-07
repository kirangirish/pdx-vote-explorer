import Link from "next/link";
import { parseCategoryTags, humanizeFallbackTitle, formatVoteDate, tallyResult } from "@/lib/votes";
import { categoryStyle } from "@/lib/categories";

export type Decision = {
  docNumber: string;
  title: string;
  aiHeadline: string | null;
  categoryTags: string | null;
  voteDate: Date | string;
  votes: { vote: string }[];
};

export function DecisionsList({
  decisions,
  categoryHref,
}: {
  decisions: Decision[];
  // When given, category tags become links to a filtered view instead of
  // plain labels -- built per-tag since the target route/query differs by
  // caller (dashboard preview links out to the full list; the full list
  // page filters itself).
  categoryHref?: (tag: string) => string;
}) {
  if (decisions.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <p className="text-xl font-bold tracking-tight text-gray-900">No decisions found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {decisions.map((decision) => {
        const tags = parseCategoryTags(decision.categoryTags);
        const result = tallyResult(decision.votes);
        const headline = decision.aiHeadline || humanizeFallbackTitle(decision.title);
        return (
          <div
            key={decision.docNumber}
            className="group relative flex items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <Link href={`/documents/${decision.docNumber}`} className="absolute inset-0 rounded-2xl z-0">
              <span className="sr-only">{headline}</span>
            </Link>
            <div className="min-w-0">
              {tags.length > 0 && (
                <div className="relative z-10 flex flex-wrap gap-1.5 mb-1.5">
                  {tags.map((tag) =>
                    categoryHref ? (
                      <Link
                        key={tag}
                        href={categoryHref(tag)}
                        className={`${categoryStyle(tag)} text-[11px] font-semibold px-2 py-0.5 rounded-full hover:opacity-70 transition`}
                      >
                        {tag}
                      </Link>
                    ) : (
                      <span
                        key={tag}
                        className={`${categoryStyle(tag)} text-[11px] font-semibold px-2 py-0.5 rounded-full`}
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>
              )}
              <p className="font-bold tracking-tight text-gray-900 group-hover:text-pdx-blue transition-colors truncate">
                {headline}
              </p>
              <p className="text-xs text-gray-500 mt-1">{formatVoteDate(decision.voteDate)}</p>
            </div>
            {result && (
              <span
                className={`relative z-10 shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${
                  result.passed ? "bg-yea/10 text-yea" : "bg-nay/10 text-nay"
                }`}
              >
                {result.passed ? "PASSED" : "REJECTED"} {result.yea}:{result.nay}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
