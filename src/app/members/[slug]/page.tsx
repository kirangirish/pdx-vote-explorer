import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MemberAvatar, type Member } from "@/components/MemberAvatar";
import {
  VOTE_LABELS,
  VOTE_ORDER,
  VOTE_BADGE_STYLES,
  VOTE_BADGE_STYLES_ACTIVE,
  parseCategoryTags,
  formatVoteDate,
} from "@/lib/votes";

const RECENT_WINDOW_DAYS = 60;

async function getMember(slug: string, voteFilter: string | null) {
  const member = await prisma.councilMember.findUnique({ where: { slug } });
  if (!member) return null;

  const [voteCounts, votes] = await Promise.all([
    prisma.memberVote.groupBy({
      by: ["vote"],
      where: { memberId: member.id },
      _count: { vote: true },
    }),
    voteFilter
      ? prisma.memberVote.findMany({
          // Filtering by vote type pulls the member's full record for that
          // type (matches the all-time breakdown above), not just recent.
          // SQLite has no case-insensitive `mode` filter, so match the exact
          // stored casing (VOTE_LABELS[voteFilter], e.g. "YEA" -> "Yea").
          where: { memberId: member.id, vote: VOTE_LABELS[voteFilter] },
          include: { document: true },
          orderBy: { document: { voteDate: "desc" } },
        })
      : prisma.memberVote.findMany({
          where: {
            memberId: member.id,
            document: { voteDate: { gte: new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000) } },
          },
          include: { document: true },
          orderBy: { document: { voteDate: "desc" } },
        }),
  ]);

  return { member, voteCounts, votes };
}

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vote?: string }>;
}) {
  const { slug } = await params;
  const { vote } = await searchParams;
  const voteFilter = vote && VOTE_ORDER.includes(vote.toUpperCase()) ? vote.toUpperCase() : null;

  const data = await getMember(decodeURIComponent(slug), voteFilter);

  if (!data) {
    notFound();
  }
  const { member, voteCounts, votes } = data;

  const countsByType: Record<string, number> = {};
  for (const c of voteCounts) {
    countsByType[c.vote.toUpperCase()] = c._count.vote;
  }
  const totalVotes = voteCounts.reduce((sum, c) => sum + c._count.vote, 0);

  return (
    <div className="space-y-8">
      <Link href="/" className="text-sm text-pdx-blue hover:underline">
        &larr; Back to dashboard
      </Link>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-5">
          <MemberAvatar member={member as Member} size={80} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{member.fullName}</h1>
            <p className="text-sm text-gray-500">
              {member.district === 0 ? "Mayor — Citywide" : `District ${member.district}`}
            </p>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-3">
          Voting Record ({totalVotes} votes total) &mdash; click a total to see every vote of that type
        </h2>
        <div className="flex flex-wrap gap-2">
          {VOTE_ORDER.map((key) => {
            const isActive = voteFilter === key;
            return (
              <Link
                key={key}
                href={isActive ? `/members/${slug}` : `/members/${slug}?vote=${key}`}
                className={`${isActive ? VOTE_BADGE_STYLES_ACTIVE[key] : VOTE_BADGE_STYLES[key]} text-sm font-semibold px-3 py-1.5 rounded-full transition hover:opacity-80`}
              >
                {VOTE_LABELS[key]} {countsByType[key] ?? 0}
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">
            {voteFilter
              ? `All ${VOTE_LABELS[voteFilter]} Votes (${countsByType[voteFilter] ?? 0})`
              : `Votes — Last ${RECENT_WINDOW_DAYS} Days`}
          </h2>
          {voteFilter && (
            <Link href={`/members/${slug}`} className="text-sm text-pdx-blue hover:underline">
              Show recent activity
            </Link>
          )}
        </div>
        {votes.length === 0 ? (
          <p className="text-gray-500">
            {voteFilter ? "No votes of this type recorded." : "No votes recorded in this window."}
          </p>
        ) : (
          <div className="space-y-3">
            {votes.map((v) => {
              const tags = parseCategoryTags(v.document.categoryTags);
              const voteKey = v.vote.toUpperCase();
              return (
                <div
                  key={v.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/documents/${v.document.docNumber}`}
                      className="font-medium text-gray-900 hover:text-pdx-blue hover:underline"
                    >
                      {v.document.aiHeadline || v.document.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">{formatVoteDate(v.document.voteDate)}</p>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-pdx-green/10 text-pdx-green text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span
                    className={`${VOTE_BADGE_STYLES[voteKey] ?? "bg-gray-100 text-gray-600"} text-xs font-semibold px-2.5 py-1 rounded-full shrink-0`}
                  >
                    {VOTE_LABELS[voteKey] ?? v.vote}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
