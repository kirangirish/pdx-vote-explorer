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

export function DecisionsList({ decisions }: { decisions: Decision[] }) {
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
        return (
          <Link
            key={decision.docNumber}
            href={`/documents/${decision.docNumber}`}
            className="group flex items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="min-w-0">
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className={`${categoryStyle(tag)} text-[11px] font-semibold px-2 py-0.5 rounded-full`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="font-bold tracking-tight text-gray-900 group-hover:text-pdx-blue transition-colors truncate">
                {decision.aiHeadline || humanizeFallbackTitle(decision.title)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{formatVoteDate(decision.voteDate)}</p>
            </div>
            {result && (
              <span
                className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${
                  result.passed ? "bg-yea/10 text-yea" : "bg-nay/10 text-nay"
                }`}
              >
                {result.passed ? "PASSED" : "REJECTED"} {result.yea}:{result.nay}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
