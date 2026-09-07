import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DecisionsList } from "@/components/DecisionsList";
import { categoryStyle } from "@/lib/categories";
import { GOVERNING_BODIES } from "@/lib/governing-body";

export const metadata = {
  title: "All Decisions — PDX Vote Explorer",
  description: "Every recorded Portland City Council decision.",
};

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const config = GOVERNING_BODIES.portland_council;
  const decisions = await prisma.councilDocument.findMany({
    where: {
      governingBody: "portland_council",
      ...(category ? { categoryTags: { contains: category } } : {}),
    },
    orderBy: { voteDate: "desc" },
    include: { votes: true },
  });

  return (
    <div className="space-y-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-pdx-blue hover:gap-2.5 transition-all">
        <ArrowLeft size={15} />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-black tracking-tight text-gray-900">All Decisions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every recorded {config.fullName} decision, most recent first.
        </p>
        {category && (
          <Link
            href="/decisions"
            className={`${categoryStyle(category)} inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mt-3 hover:opacity-70 transition`}
          >
            {category}
            <X size={12} />
          </Link>
        )}
      </div>

      <DecisionsList
        decisions={decisions}
        categoryHref={(tag) => `/decisions?category=${encodeURIComponent(tag)}`}
      />
    </div>
  );
}
