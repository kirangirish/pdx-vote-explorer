import Link from "next/link";
import { Star, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MemberAvatar, type Member } from "@/components/MemberAvatar";
import { parseCategoryTags, humanizeFallbackTitle } from "@/lib/votes";
import { categoryStyle } from "@/lib/categories";
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

function tallyResult(votes: { vote: string }[]) {
  let yea = 0;
  let nay = 0;
  for (const v of votes) {
    const key = v.vote.toUpperCase();
    if (key === "YEA") yea++;
    else if (key === "NAY") nay++;
  }
  if (yea === 0 && nay === 0) return null;
  return { yea, nay, passed: yea > nay };
}

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
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Latest Decisions</h2>
        {recentDecisions.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xl font-bold tracking-tight text-gray-900">No recent decisions found.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
            {recentDecisions.map((decision) => {
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
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-black tracking-tight text-gray-900">{config.fullName}</h2>
            {atLarge && config.atLargeIsVotingMember && (
              <Link
                href={`/members/${atLarge.slug}`}
                className="flex items-center gap-2.5 bg-white border border-pdx-yellow/30 rounded-full pl-1 pr-4 py-1.5 shadow-sm hover:bg-pdx-yellow/10 hover:border-pdx-yellow/50 transition"
              >
                <MemberAvatar member={atLarge} size={40} asLink={false} />
                <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                  <Star size={13} className="text-yellow-700 shrink-0" />
                  {atLarge.fullName}
                </span>
              </Link>
            )}
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
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
