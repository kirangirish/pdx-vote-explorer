import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MemberAvatar, type Member } from "@/components/MemberAvatar";
import { parseCategoryTags } from "@/lib/votes";

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

  const tags = latestDecision ? parseCategoryTags(latestDecision.categoryTags) : [];

  return (
    <div className="space-y-8">
      {latestDecision ? (
        <Link
          href={`/documents/${latestDecision.docNumber}`}
          className="block bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-pdx-blue hover:shadow-md transition"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Latest Decision Summary</h2>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
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
          <p className="text-xl font-medium text-gray-900 hover:text-pdx-blue transition">
            {latestDecision.aiHeadline || latestDecision.title}
          </p>
        </Link>
      ) : (
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Latest Decision Summary</h2>
          <p className="text-xl font-medium text-gray-900">No recent decisions found.</p>
        </section>
      )}

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
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
