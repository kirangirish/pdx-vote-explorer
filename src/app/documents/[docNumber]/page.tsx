import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MemberAvatar, type Member } from "@/components/MemberAvatar";
import { VOTE_LABELS, VOTE_ORDER, parseCategoryTags, formatVoteDate } from "@/lib/votes";

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
      <Link href="/" className="text-sm text-pdx-blue hover:underline">
        &larr; Back to dashboard
      </Link>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="bg-pdx-green/10 text-pdx-green text-xs font-semibold px-3 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900">
          {document.aiHeadline || document.title}
        </h1>
        <p className="text-sm text-gray-500">{formatVoteDate(document.voteDate)}</p>
        <p className="text-gray-700">
          {document.aiSummary || "No AI summary generated yet for this item."}
        </p>
      </section>

      <section id="votes" className="scroll-mt-6">
        <h2 className="text-xl font-bold text-gray-900 mb-5">Vote Breakdown</h2>
        {document.votes.length === 0 ? (
          <p className="text-gray-500">No votes recorded for this item yet.</p>
        ) : (
          <div className="space-y-8">
            {VOTE_ORDER.filter((key) => votesByResult[key]?.length).map((key) => (
              <div key={key}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {VOTE_LABELS[key] ?? key} ({votesByResult[key].length})
                </h3>
                <div className="flex flex-wrap gap-4">
                  {votesByResult[key].map((member) => (
                    <MemberAvatar key={member.id} member={member} size={56} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
