import Link from "next/link";
import { Star, MapPin, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MemberAvatar, type Member } from "@/components/MemberAvatar";
import { DecisionsList } from "@/components/DecisionsList";
import { GOVERNING_BODIES, type GoverningBody } from "@/lib/governing-body";

const RECENT_DECISIONS_LIMIT = 3;

async function getDashboardData(governingBody: GoverningBody) {
  const members = await prisma.councilMember.findMany({ where: { governingBody } });
  const recentDecisions = await prisma.councilDocument.findMany({
    where: { governingBody },
    orderBy: { voteDate: "desc" },
    take: RECENT_DECISIONS_LIMIT,
    include: { votes: true },
  });
  return { members, recentDecisions };
}

// Tailwind needs each class string to appear literally in source -- can't
// build "bg-district-N" from a template string at runtime.
const DISTRICT_BADGE_CLASSES: Record<number, string> = {
  1: "bg-district-1 text-white",
  2: "bg-district-2 text-white",
  3: "bg-district-3 text-white",
  4: "bg-district-4 text-white",
};

export async function Dashboard({ governingBody }: { governingBody: GoverningBody }) {
  const config = GOVERNING_BODIES[governingBody];
  const { members, recentDecisions } = await getDashboardData(governingBody);

  const byDistrict: Record<number, Member[]> = {};
  for (const d of config.districts) byDistrict[d] = [];
  let atLarge: Member | null = null;
  for (const member of members as Member[]) {
    if (member.district === 0) {
      atLarge = member;
    } else {
      (byDistrict[member.district] ??= []).push(member);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Latest Decisions</h2>
          <Link
            href={config.decisionsHref}
            className="flex items-center gap-1 text-sm font-semibold text-pdx-blue hover:gap-1.5 transition-all"
          >
            See all decisions
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="max-h-[32rem] overflow-y-auto pr-1">
          <DecisionsList decisions={recentDecisions} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-black tracking-tight text-gray-900">{config.fullName}</h2>
            {atLarge && !config.atLargeIsVotingMember && (
              <Link
                href={`/members/${atLarge.slug}`}
                className="flex items-center gap-2 bg-white border border-pdx-yellow/30 rounded-full pl-1 pr-3 py-1 shadow-sm hover:bg-pdx-yellow/10 hover:border-pdx-yellow/50 transition"
              >
                <MemberAvatar member={atLarge} size={28} asLink={false} />
                <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-900">
                  <Star size={10} className="text-yellow-700 shrink-0" />
                  {atLarge.fullName}
                </span>
              </Link>
            )}
          </div>
          <a
            href={config.findDistrictUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-semibold text-pdx-blue bg-pdx-blue/10 hover:bg-pdx-blue/20 transition px-3 py-1.5 rounded-full"
          >
            <MapPin size={14} />
            Find your district
          </a>
        </div>

        <div
          className={`grid grid-cols-2 ${config.atLargeIsVotingMember ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-6`}
        >
          {atLarge && config.atLargeIsVotingMember && (
            <div className="flex flex-col items-center gap-6">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-pdx-yellow text-white">
                <Star size={11} className="shrink-0" />
                {config.atLargeTitle}
              </span>
              <MemberAvatar member={atLarge} />
            </div>
          )}
          {config.districts.map((district) => (
            <div key={district} className="flex flex-col items-center gap-6">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${DISTRICT_BADGE_CLASSES[district]}`}
              >
                District {district}
              </span>
              {byDistrict[district].map((member) => (
                <MemberAvatar key={member.id} member={member} />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
