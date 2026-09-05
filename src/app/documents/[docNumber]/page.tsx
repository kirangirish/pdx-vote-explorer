import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MemberAvatar, type Member } from "@/components/MemberAvatar";
import {
  VOTE_LABELS,
  VOTE_ORDER,
  VOTE_ICONS,
  VOTE_BADGE_STYLES,
  parseCategoryTags,
  formatVoteDate,
  humanizeFallbackTitle,
} from "@/lib/votes";
import { categoryStyle } from "@/lib/categories";

async function getDocument(docNumber: string) {
  return prisma.councilDocument.findUnique({
    where: { docNumber },
    include: { votes: { include: { member: true } } },
  });
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ docNumber: string }>;
}) {
  const { docNumber } = await params;
  const document = await getDocument(decodeURIComponent(docNumber));

  if (!document) {
    notFound();
  }

  const votesByResult: Record<string, Member[]> = {};
  for (const vote of document.votes) {
    const key = vote.vote.toUpperCase();
    (votesByResult[key] ??= []).push(vote.member as Member);
  }

  const tags = parseCategoryTags(document.categoryTags);

  return (
    <div className="space-y-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-pdx-blue hover:gap-2.5 transition-all">
        <ArrowLeft size={15} />
        Back to dashboard
      </Link>

      <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className={`${categoryStyle(tag)} text-xs font-semibold px-3 py-1 rounded-full`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          {document.aiHeadline || humanizeFallbackTitle(document.title)}
        </h1>
        <p className="text-sm text-gray-500">{formatVoteDate(document.voteDate)}</p>
        {document.aiSummary && (
          <p className="flex items-center gap-1.5 text-xs font-bold text-pdx-blue uppercase tracking-wider">
            <Sparkles size={13} />
            AI-generated summary
          </p>
        )}
        <p className="text-gray-700 leading-relaxed">
          {document.aiSummary || "No AI summary generated yet for this item."}
          {document.sourceUrl && (
            <a
              href={document.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="View the official government record"
              className="text-pdx-blue text-sm font-semibold hover:underline ml-1 align-super"
            >
              [1]
            </a>
          )}
        </p>
      </section>

      <section id="votes" className="scroll-mt-6">
        <h2 className="text-xl font-black tracking-tight text-gray-900 mb-5">Vote Breakdown</h2>
        {document.votes.length === 0 ? (
          <p className="text-gray-500">No votes recorded for this item yet.</p>
        ) : (
          <div className="space-y-8">
            {VOTE_ORDER.filter((key) => votesByResult[key]?.length).map((key) => {
              const Icon = VOTE_ICONS[key];
              return (
                <div key={key}>
                  <h3
                    className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-3 px-2.5 py-1 rounded-full ${VOTE_BADGE_STYLES[key]}`}
                  >
                    <Icon size={13} />
                    {VOTE_LABELS[key] ?? key} ({votesByResult[key].length})
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    {votesByResult[key].map((member) => (
                      <MemberAvatar key={member.id} member={member} size={56} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
