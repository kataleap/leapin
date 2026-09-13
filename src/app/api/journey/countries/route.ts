import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { filterCountriesByNationality } from "@/lib/orders/country-eligibility";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
// It matters more here than it used to: the list is now per-nationality, so
// a cached copy is one client's list served to another.
export const dynamic = "force-dynamic";

// Not in doc §8.2's endpoint list, but the client journey needs a way to
// pick a country whenever a package/journey includes a variable_by_country
// stage (foreign company formation by proxy) — a small, low-risk addition.
export async function GET() {
  const { session, response } = await requireAuth();
  if (response) return response;

  const countries = await prisma.country.findMany({
    where: { status: "active" },
    include: { nationalityRestrictions: { select: { nationalityCode: true, isEligible: true } } },
    orderBy: { nameAr: "asc" },
  });

  // Staff browse the full catalogue (they configure and support it); a client
  // sees only what their own nationality can actually use — doc §5.1.
  if (session.user.role !== UserRole.client) {
    return NextResponse.json({ countries });
  }

  const client = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nationality: true },
  });

  return NextResponse.json({
    countries: filterCountriesByNationality(countries, client?.nationality),
    // Lets the wizard say "some options are hidden because of your
    // nationality" instead of silently showing a shorter list.
    filteredByNationality: client?.nationality ?? null,
  });
}
