import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DecisionsList } from "@/components/DecisionsList";
import { GOVERNING_BODIES } from "@/lib/governing-body";

export const metadata = {
  title: "All Decisions — PDX Vote Explorer",
  description: "Every recorded Multnomah County Board decision.",
};

export default async function CountyDecisionsPage() {
  const config = GOVERNING_BODIES.multnomah_county;
  const decisions = await prisma.councilDocument.findMany({
    where: { governingBody: "multnomah_county" },
    orderBy: { voteDate: "desc" },
    include: { votes: true },
  });

  return (
    <div className="space-y-8">
      <Link href="/county" className="inline-flex items-center gap-1.5 text-sm font-semibold text-pdx-blue hover:gap-2.5 transition-all">
        <ArrowLeft size={15} />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-black tracking-tight text-gray-900">All Decisions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every recorded {config.fullName} decision, most recent first.
        </p>
      </div>

      <DecisionsList decisions={decisions} />
    </div>
  );
}
