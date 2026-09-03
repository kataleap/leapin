import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  const categoryId = new URL(request.url).searchParams.get("category");
  if (!categoryId) {
    return NextResponse.json({ error: "The 'category' query parameter is required." }, { status: 400 });
  }

  const activities = await prisma.activity.findMany({
    where: { categoryId, isActive: true },
  });
  return NextResponse.json({ activities });
}
