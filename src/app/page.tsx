import Image from "next/image";
import { prisma } from "@/lib/prisma";

type Member = {
  id: string;
  fullName: string;
  district: number;
  photoUrl: string | null;
};

async function getDashboardData() {
  const members = await prisma.councilMember.findMany();
  const latestDecision = await prisma.councilDocument.findFirst({
    orderBy: { voteDate: 'desc' },
  });
  return { members, latestDecision };
}

function initials(fullName: string) {
  return fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function MemberAvatar({ member }: { member: Member }) {
  return (
    <div className="group relative w-24 h-24 rounded-full ring-2 ring-transparent hover:ring-pdx-green transition cursor-pointer">
      {member.photoUrl ? (
        <Image
          src={member.photoUrl}
          alt={member.fullName}
          width={96}
          height={96}
          priority
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-pdx-blue/10 text-pdx-blue flex items-center justify-center font-semibold">
          {initials(member.fullName)}
        </div>
      )}
      <div className="absolute inset-0 rounded-full bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-center px-2">
        <span className="text-white text-[11px] font-semibold leading-tight">
          {member.fullName}
        </span>
      </div>
    </div>
  );
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
