import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  // Doc §8.2 lists this endpoint as `?track=&category=`, but Package has no
  // categoryId in the schema (only trackId) — filtering by category isn't
  // representable yet, so only `track` is applied here.
  const trackId = new URL(request.url).searchParams.get("track");

  // A package's trackId is optional (doc §5.1: "usually tied to one track")
  // — a null trackId is a deliberate track-agnostic package (e.g. doc §6.2's
  // "foreign company formation only" scenario, requestable regardless of
  // which main track the client is on), not a data-entry omission. So when
  // filtering by track, track-agnostic packages must still be included.
  const packages = await prisma.package.findMany({
    where: { isActive: true, ...(trackId ? { OR: [{ trackId }, { trackId: null }] } : {}) },
    include: { packageStages: { include: { stage: { include: { stagePricing: true } } } } },
  });

  // Lets the client UI proactively show a country selector instead of
  // discovering the requirement via a failed /journey/estimate call.
  const withRequiresCountry = packages.map((pkg) => ({
    ...pkg,
    requiresCountry: pkg.packageStages.some((ps) =>
      ps.stage.stagePricing.some((sp) => sp.pricingType === "variable_by_country")
    ),
  }));

  return NextResponse.json({ packages: withRequiresCountry });
}
