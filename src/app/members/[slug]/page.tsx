import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MemberAvatar, type Member } from "@/components/MemberAvatar";
import {
  VOTE_LABELS,
  VOTE_ORDER,
  VOTE_BADGE_STYLES,
  parseCategoryTags,
  formatVoteDate,
} from "@/lib/votes";

const RECENT_WINDOW_DAYS = 60;

async function getMember(slug: string) {
  const member = await prisma.councilMember.findUnique({ where: { slug } });
  if (!member) return null;

  const [voteCounts, recentVotes] = await Promise.all([
    prisma.memberVote.groupBy({
      by: ["vote"],
      where: { memberId: member.id },
      _count: { vote: true },
    }),
    prisma.memberVote.findMany({
      where: {
        memberId: member.id,
        document: { voteDate: { gte: new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000) } },
      },
      include: { document: true },
      orderBy: { document: { voteDate: "desc" } },
    }),
  ]);

  return { member, voteCounts, recentVotes };
}

export default async function MemberPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getMember(decodeURIComponent(slug));

  if (!data) {
    notFound();
  }
  const { member, voteCounts, recentVotes } = data;

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
          Voting Record ({totalVotes} votes total)
        </h2>
        <div className="flex flex-wrap gap-2">
          {VOTE_ORDER.map((key) => (
            <span
              key={key}
              className={`${VOTE_BADGE_STYLES[key]} text-sm font-semibold px-3 py-1.5 rounded-full`}
            >
              {VOTE_LABELS[key]} {countsByType[key] ?? 0}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-5">
          Votes &mdash; Last {RECENT_WINDOW_DAYS} Days
        </h2>
        {recentVotes.length === 0 ? (
          <p className="text-gray-500">No votes recorded in this window.</p>
        ) : (
          <div className="space-y-3">
            {recentVotes.map((v) => {
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
