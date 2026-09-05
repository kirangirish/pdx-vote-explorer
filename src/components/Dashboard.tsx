import Link from "next/link";
import { ArrowRight, Star, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MemberAvatar, type Member } from "@/components/MemberAvatar";
import { parseCategoryTags, humanizeFallbackTitle } from "@/lib/votes";
import { categoryStyle } from "@/lib/categories";
import { GOVERNING_BODIES, type GoverningBody } from "@/lib/governing-body";

async function getDashboardData(governingBody: GoverningBody) {
  const members = await prisma.councilMember.findMany({ where: { governingBody } });
  const latestDecision = await prisma.councilDocument.findFirst({
    where: { governingBody },
    orderBy: { voteDate: "desc" },
  });
  return { members, latestDecision };
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
  const { members, latestDecision } = await getDashboardData(governingBody);

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

  const tags = latestDecision ? parseCategoryTags(latestDecision.categoryTags) : [];

  return (
    <div className="space-y-8">
      {latestDecision ? (
        <Link
          href={`/documents/${latestDecision.docNumber}`}
          className="group block bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-pdx-blue hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Latest Decision Summary</h2>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
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
          <div className="flex items-center justify-between gap-4">
            <p className="text-xl font-bold tracking-tight text-gray-900 group-hover:text-pdx-blue transition-colors">
              {latestDecision.aiHeadline || humanizeFallbackTitle(latestDecision.title)}
            </p>
            <ArrowRight className="shrink-0 text-gray-300 group-hover:text-pdx-blue group-hover:translate-x-1 transition-all" size={22} />
          </div>
        </Link>
      ) : (
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Latest Decision Summary</h2>
          <p className="text-xl font-bold tracking-tight text-gray-900">No recent decisions found.</p>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black tracking-tight text-gray-900">{config.fullName}</h2>
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

        {atLarge && (
          <div className="flex items-center gap-4 bg-gradient-to-r from-pdx-yellow/15 to-transparent p-4 rounded-2xl border border-pdx-yellow/30 mb-6">
            <MemberAvatar member={atLarge} size={64} />
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-yellow-700 uppercase tracking-wider">
                <Star size={13} />
                {config.atLargeTitle}
              </p>
              <p className="font-bold text-gray-900">{atLarge.fullName}</p>
            </div>
          </div>
        )}

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
