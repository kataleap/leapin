import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

// Not in doc §8.2's endpoint list, but the client journey needs a way to
// pick a country whenever a package/journey includes a variable_by_country
// stage (foreign company formation by proxy) — a small, low-risk addition.
export async function GET() {
  const { response } = await requireAuth();
  if (response) return response;

  const countries = await prisma.country.findMany({ where: { status: "active" } });
  return NextResponse.json({ countries });
}
