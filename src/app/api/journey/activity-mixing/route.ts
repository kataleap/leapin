import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

// Given a base activity category (the client's Stage-0 choice), returns the
// other categories it's allowed to add activities from per §3.2's mixing
// matrix (e.g. commercial -> service).
export async function GET(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  const categoryId = new URL(request.url).searchParams.get("category");
  if (!categoryId) {
    return NextResponse.json({ error: "The 'category' query parameter is required." }, { status: 400 });
  }

  const rules = await prisma.activityMixingRule.findMany({
    where: { baseCategoryId: categoryId, isAllowed: true, addableCategory: { status: "active" } },
    include: { addableCategory: true },
  });

  return NextResponse.json({ addableCategories: rules.map((r) => r.addableCategory) });
}
