import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MemberAvatar, type Member } from "@/components/MemberAvatar";

async function getDashboardData() {
  const members = await prisma.councilMember.findMany();
  const latestDecision = await prisma.councilDocument.findFirst({
    orderBy: { voteDate: 'desc' },
  });
  return { members, latestDecision };
}

export default async function Home() {
  const { members, latestDecision } = await getDashboardData();

  const byDistrict: Record<number, Member[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const member of members as Member[]) {
    (byDistrict[member.district] ??= []).push(member);
  }

  return (
    <div className="space-y-8">
      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Latest Decision Summary</h2>
        <p className="text-xl font-medium text-gray-900 mb-6">
          {latestDecision?.title || "No recent decisions found."}
        </p>
        {latestDecision && (
          <div className="flex gap-3">
            <Link
              href={`/documents/${latestDecision.docNumber}`}
              className="bg-pdx-blue text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
            >
              Read Summary
            </Link>
            <Link
              href={`/documents/${latestDecision.docNumber}#votes`}
              className="bg-pdx-yellow text-gray-900 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-yellow-500 transition"
            >
              See Vote Breakdown
            </Link>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">Explore Council Members</h2>
          <a
            href="https://pdx.maps.arcgis.com/apps/instant/lookup/index.html?appid=e2e4809ee732411c9f0dca06c78cda38"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-pdx-blue hover:underline"
          >
            Find your district &rarr;
          </a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((district) => (
            <div key={district} className="flex flex-col items-center gap-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                District {district}
              </h3>
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
