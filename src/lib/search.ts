import { prisma } from "@/lib/prisma";

// Header dropdown only: quick jumps, kept deliberately small.
export const DROPDOWN_LIMIT = 5;

export function searchMembers(q: string, limit = DROPDOWN_LIMIT) {
  return prisma.councilMember.findMany({
    where: { fullName: { contains: q, mode: "insensitive" } },
    select: { slug: true, fullName: true, photoUrl: true, district: true, governingBody: true },
    take: limit,
  });
}

export function searchDocuments(q: string, limit = DROPDOWN_LIMIT) {
  return prisma.councilDocument.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { aiHeadline: { contains: q, mode: "insensitive" } },
        { categoryTags: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { docNumber: true, title: true, aiHeadline: true, governingBody: true, voteDate: true },
    orderBy: { voteDate: "desc" },
    take: limit,
  });
}

export async function search(q: string, limit = DROPDOWN_LIMIT) {
  const [members, documents] = await Promise.all([
    searchMembers(q, limit),
    searchDocuments(q, limit),
  ]);
  return { members, documents };
}
