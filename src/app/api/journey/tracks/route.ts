import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireAuth();
  if (response) return response;

  const tracks = await prisma.track.findMany({
    where: { status: "active" },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ tracks });
}
