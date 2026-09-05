import { prisma } from "@/lib/prisma";

async function getDashboardData() {
  const members = await prisma.councilMember.findMany();
  const latestDecision = await prisma.councilDocument.findFirst({
    orderBy: { voteDate: 'desc' },
  });
  return { members, latestDecision };
}

export default async function Home() {
  const { members, latestDecision } = await getDashboardData();

  return (
    <div className="space-y-8">
      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Latest Decision Summary</h2>
        <p className="text-xl font-medium text-gray-900 mb-6">
          {latestDecision?.title || "No recent decisions found."}
        </p>
        <div className="flex gap-3">
          <button 
            className="bg-pdx-blue text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
          >
            Read Summary
          </button>
          <button 
            className="bg-pdx-yellow text-gray-900 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-yellow-500 transition"
          >
            See Vote Breakdown
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-5">Explore Council Members</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {members.map((member: { id: string; fullName: string; district: number }) => (
            <div key={member.id} className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-pdx-green hover:shadow-md transition cursor-pointer">
              <h3 className="font-semibold text-gray-900">{member.fullName}</h3>
              <p className="text-sm text-gray-500">District: {member.district}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
