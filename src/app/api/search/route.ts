import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RESULT_LIMIT = 5;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ members: [], documents: [] });
  }

  const [members, documents] = await Promise.all([
    prisma.councilMember.findMany({
      where: { fullName: { contains: q } },
      select: { slug: true, fullName: true, photoUrl: true, district: true, governingBody: true },
      take: RESULT_LIMIT,
    }),
    prisma.councilDocument.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { aiHeadline: { contains: q } },
          { categoryTags: { contains: q } },
        ],
      },
      select: { docNumber: true, title: true, aiHeadline: true, governingBody: true, voteDate: true },
      orderBy: { voteDate: "desc" },
      take: RESULT_LIMIT,
    }),
  ]);

  return NextResponse.json({ members, documents });
}
