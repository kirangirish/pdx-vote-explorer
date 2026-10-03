import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SectionTabs } from "@/components/SectionTabs";
import { categoryStyle } from "@/lib/categories";
import { GOVERNING_BODIES, type GoverningBody } from "@/lib/governing-body";
import {
  VOTE_LABELS,
  formatVoteDate,
  humanizeFallbackTitle,
  parseCategoryTags,
  tallyResult,
} from "@/lib/votes";

export type SplitSort = "closest" | "recent";

// Tailwind needs each class string to appear literally in source.
const STRIP_CLASSES: Record<string, string> = {
  YEA: "bg-yea",
  NAY: "bg-nay",
  ABSENT: "bg-absent/30",
  ABSTAIN: "bg-abstain",
};

type MemberRef = { slug: string; fullName: string; district: number };

export async function SplitVotes({
  governingBody,
  category,
  sort,
}: {
  governingBody: GoverningBody;
  category?: string;
  sort: SplitSort;
}) {
  const config = GOVERNING_BODIES[governingBody];
  const documents = await prisma.councilDocument.findMany({
    where: { governingBody },
    orderBy: { voteDate: "desc" },
    include: {
      votes: { include: { member: { select: { slug: true, fullName: true, district: true } } } },
    },
  });

  // A decision is "split" when at least one member voted Nay. Decisions with
  // no Yea/Nay at all (nothing recorded yet) are left out of every count.
  const decided = documents.flatMap((doc) => {
    const result = tallyResult(doc.votes);
    return result ? [{ doc, result }] : [];
  });
  const split = decided.filter(({ result }) => result.nay > 0);
  const failedCount = split.filter(({ result }) => !result.passed).length;
  const unanimousPct = decided.length ? (100 * (decided.length - split.length)) / decided.length : 0;

  const categories = Array.from(new Set(split.flatMap(({ doc }) => parseCategoryTags(doc.categoryTags)))).sort();
  const shown = split
    .filter(({ doc }) => !category || parseCategoryTags(doc.categoryTags).includes(category))
    .sort((a, b) => {
      if (sort === "closest") {
        const byMargin = Math.abs(a.result.yea - a.result.nay) - Math.abs(b.result.yea - b.result.nay);
        if (byMargin !== 0) return byMargin;
      }
      return new Date(b.doc.voteDate).getTime() - new Date(a.doc.voteDate).getTime();
    });

  const href = (params: { category?: string; sort?: SplitSort }) => {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.sort && params.sort !== "closest") query.set("sort", params.sort);
    const qs = query.toString();
    return qs ? `${config.splitVotesHref}?${qs}` : config.splitVotesHref;
  };

  return (
    <div className="space-y-8">
      <SectionTabs governingBody={governingBody} />

      <div>
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          Most votes are unanimous. These are the ones that weren&apos;t.
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Every recorded {config.fullName} decision where at least one member voted no. Each strip shows how every
          member voted, ordered by district.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat value={decided.length.toLocaleString()} label="decisions recorded" />
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-2xl font-black tracking-tight text-gray-900 tabular-nums">{unanimousPct.toFixed(0)}%</p>
          <p className="text-xs text-gray-500">had no &ldquo;Nay&rdquo; votes</p>
          <div
            className="mt-2 h-1.5 rounded-full bg-nay/20 overflow-hidden"
            role="img"
            aria-label={`${unanimousPct.toFixed(0)} percent unanimous`}
          >
            <div className="h-full bg-yea" style={{ width: `${unanimousPct}%` }} />
          </div>
        </div>
        <Stat
          value={split.length.toLocaleString()}
          label={`split votes, ${failedCount} of which ${failedCount === 1 ? "was" : "were"} rejected`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          <FilterChip href={href({ sort })} active={!category} label="All" />
          {categories.map((tag) => (
            <FilterChip
              key={tag}
              href={href({ category: tag, sort })}
              active={category === tag}
              label={tag}
              tagClass={categoryStyle(tag)}
            />
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-full p-1 text-xs font-bold" role="group" aria-label="Sort">
          {(["closest", "recent"] as const).map((option) => (
            <Link
              key={option}
              href={href({ category, sort: option })}
              aria-current={sort === option ? "true" : undefined}
              className={
                sort === option
                  ? "px-3 py-1 rounded-full bg-white text-gray-900 shadow-sm"
                  : "px-3 py-1 rounded-full text-gray-500 hover:text-gray-900"
              }
            >
              {option === "closest" ? "Closest first" : "Most recent"}
            </Link>
          ))}
        </div>
      </div>

      <VoteLegend atLargeTitle={config.atLargeTitle} />

      {shown.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xl font-bold tracking-tight text-gray-900">No split votes{category ? " in this category" : ""}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(({ doc, result }) => {
            const headline = doc.aiHeadline || humanizeFallbackTitle(doc.title);
            const margin = Math.abs(result.yea - result.nay);
            const ordered = [...doc.votes].sort(
              (a, b) => a.member.district - b.member.district || a.member.fullName.localeCompare(b.member.fullName)
            );
            const nays = ordered.filter((v) => v.vote.toUpperCase() === "NAY").map((v) => v.member);
            return (
              <div
                key={doc.docNumber}
                className="group relative bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <Link href={`/documents/${doc.docNumber}`} className="absolute inset-0 rounded-2xl z-0">
                  <span className="sr-only">{headline}</span>
                </Link>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    {parseCategoryTags(doc.categoryTags).length > 0 && (
                      <div className="relative z-10 flex flex-wrap gap-1.5 mb-1.5">
                        {parseCategoryTags(doc.categoryTags).map((tag) => (
                          <Link
                            key={tag}
                            href={href({ category: tag, sort })}
                            className={`${categoryStyle(tag)} text-[11px] font-semibold px-2 py-0.5 rounded-full hover:opacity-70 transition`}
                          >
                            {tag}
                          </Link>
                        ))}
                      </div>
                    )}
                    <p className="font-bold tracking-tight text-gray-900 group-hover:text-pdx-blue transition-colors">
                      {headline}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatVoteDate(doc.voteDate)} · Decided by {margin} {margin === 1 ? "vote" : "votes"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                        result.passed ? "bg-yea/10 text-yea" : "bg-nay/10 text-nay"
                      }`}
                    >
                      {result.passed ? "PASSED" : "REJECTED"} {result.yea}:{result.nay}
                    </span>
                    <VoteStrip votes={ordered} />
                  </div>
                </div>
                <p className="relative z-10 text-xs text-gray-600 mt-2">
                  <span className="font-semibold text-nay">Voted no:</span>{" "}
                  {nays.map((member, i) => (
                    <span key={member.slug}>
                      {i > 0 && ", "}
                      <MemberLink member={member} />
                    </span>
                  ))}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
      <p className="text-2xl font-black tracking-tight text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
  tagClass,
}: {
  href: string;
  active: boolean;
  label: string;
  tagClass?: string;
}) {
  const base = "text-xs font-semibold px-3 py-1 rounded-full transition";
  const className = active
    ? `${base} bg-gray-900 text-white`
    : `${base} ${tagClass ?? "bg-gray-100 text-gray-600"} hover:opacity-70`;
  return (
    <Link href={href} aria-current={active ? "true" : undefined} className={className}>
      {label}
    </Link>
  );
}

function VoteStrip({ votes }: { votes: { vote: string; member: MemberRef }[] }) {
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {votes.map((v) => {
        const key = v.vote.toUpperCase();
        return (
          <i
            key={v.member.slug}
            title={`${v.member.fullName}: ${VOTE_LABELS[key] ?? v.vote}`}
            className={`block w-2.5 h-4 rounded-sm ${STRIP_CLASSES[key] ?? "bg-gray-200"}`}
          />
        );
      })}
    </span>
  );
}

function VoteLegend({ atLargeTitle }: { atLargeTitle: string }) {
  const items = [
    { key: "YEA", label: "Yea" },
    { key: "NAY", label: "Nay" },
    { key: "ABSENT", label: "Absent" },
  ];
  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
      {items.map(({ key, label }) => (
        <span key={key} className="flex items-center gap-1.5">
          <i className={`block w-2.5 h-4 rounded-sm ${STRIP_CLASSES[key]}`} />
          {label}
        </span>
      ))}
      <span>Strip order: {atLargeTitle} first, then by district</span>
    </div>
  );
}

function MemberLink({ member }: { member: MemberRef }) {
  return (
    <Link href={`/members/${member.slug}`} className="hover:text-pdx-blue hover:underline">
      {member.fullName}
    </Link>
  );
}
