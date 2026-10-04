import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ members: [], documents: [] });
  }

  const { members, documents } = await search(q);

  return NextResponse.json({ members, documents });
}
