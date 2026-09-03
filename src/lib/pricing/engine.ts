import { prisma } from "@/lib/prisma";
import type { DiscountType, StageTrackScope } from "@/generated/prisma/enums";

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

export type PricingBreakdownItem = {
  stageId: string;
  stageCode: string;
  nameAr: string;
  price: number;
};

export type PricingResult = {
  breakdown: PricingBreakdownItem[];
  total: number;
  journeyStartStageId: string;
  journeyEndStageId: string;
};

// Track.code isn't formally linked to Stage.trackScope in the schema (no
// FK — Track.code is a free-text string, kept extensible per the DB-layer
// design). This mapping is an explicit assumption based on the two
// currently-seeded track codes; flag for confirmation if a third track
// (e.g. "regional_hq") is introduced.
const TRACK_CODE_TO_STAGE_SCOPE: Record<string, StageTrackScope> = {
  regular_investment: "regular_only",
  entrepreneurship: "entrepreneurship_only",
};

function stageScopeForTrackCode(code: string): StageTrackScope {
  const scope = TRACK_CODE_TO_STAGE_SCOPE[code];
  if (!scope) {
    throw new PricingError(`No stage-scope mapping is defined for track code "${code}".`);
  }
  return scope;
}

function applyDiscount(base: number, discountType: DiscountType, discountValue: number | null): number {
  if (discountType === "percentage" && discountValue != null) {
    return base * (1 - discountValue / 100);
  }
  if (discountType === "fixed_amount" && discountValue != null) {
    return Math.max(0, base - discountValue);
  }
  return base;
}

// All stages belonging to a track (its own trackScope, plus the shared
// stages every track passes through), ordered by sequence. Reused both for
// custom-journey pricing and for initializing an order's full order_stages
// set (doc §7.1 — stages outside the selected range still get a row, just
// with status `skipped`).
export async function getTrackStages(trackId: string) {
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) throw new PricingError("Track not found.");
  const scope = stageScopeForTrackCode(track.code);

  return prisma.stage.findMany({
    where: { OR: [{ trackScope: "shared" }, { trackScope: scope }] },
    include: { stagePricing: true },
    orderBy: { sequenceOrder: "asc" },
  });
}

async function priceStages(
  stages: Awaited<ReturnType<typeof getTrackStages>>,
  countryId: string | null
): Promise<{ total: number; breakdown: PricingBreakdownItem[] }> {
  let total = 0;
  const breakdown: PricingBreakdownItem[] = [];
  let country: { basePrice: unknown } | null = null;

  for (const stage of stages) {
    for (const pricing of stage.stagePricing) {
      let price = 0;
      if (pricing.pricingType === "fixed" && pricing.basePrice != null) {
        price = Number(pricing.basePrice);
      } else if (pricing.pricingType === "variable_by_country") {
        if (!countryId) {
          throw new PricingError(`countryId is required — stage "${stage.nameAr}" is priced by country.`);
        }
        if (!country) {
          country = await prisma.country.findUnique({ where: { id: countryId } });
          if (!country) throw new PricingError("Country not found.");
        }
        price = Number(country.basePrice);
      } else if (pricing.pricingType === "bundled_only") {
        // Priced within another stage, or TBD — explicitly skipped per doc §6.1.
        continue;
      }
      // `variable_by_category` isn't resolvable from the current schema —
      // ActivityCategory carries no price field. Open item (flagged, not
      // silently guessed); contributes 0 until a business decision is made.
      total += price;
      if (price > 0) {
        breakdown.push({ stageId: stage.id, stageCode: stage.code, nameAr: stage.nameAr, price });
      }
    }
  }
  return { total, breakdown };
}

async function calculateFromPackage(packageId: string, countryId: string | null): Promise<PricingResult> {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: { packageStages: { include: { stage: { include: { stagePricing: true } } } } },
  });
  if (!pkg) throw new PricingError("Package not found.");
  if (!pkg.isActive) throw new PricingError("This package is not active.");
  if (pkg.packageStages.length === 0) throw new PricingError("This package has no stages configured.");

  const sortedStages = pkg.packageStages
    .map((ps) => ps.stage)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const journeyStartStageId = sortedStages[0].id;
  const journeyEndStageId = sortedStages[sortedStages.length - 1].id;

  let total: number;
  let breakdown: PricingBreakdownItem[];

  if (pkg.totalPriceOverride != null) {
    total = Number(pkg.totalPriceOverride);
    breakdown = [{ stageId: pkg.id, stageCode: pkg.code, nameAr: pkg.nameAr, price: total }];
  } else {
    const priced = await priceStages(sortedStages, countryId);
    total = priced.total;
    breakdown = priced.breakdown;
  }

  total = applyDiscount(total, pkg.discountType, pkg.discountValue != null ? Number(pkg.discountValue) : null);
  return { breakdown, total, journeyStartStageId, journeyEndStageId };
}

async function calculateCustomJourney(
  trackId: string,
  startStageId: string,
  endStageId: string,
  countryId: string | null
): Promise<PricingResult> {
  const [startStage, endStage] = await Promise.all([
    prisma.stage.findUnique({ where: { id: startStageId } }),
    prisma.stage.findUnique({ where: { id: endStageId } }),
  ]);
  if (!startStage || !endStage) throw new PricingError("Invalid startStageId or endStageId.");
  if (startStage.sequenceOrder > endStage.sequenceOrder) {
    throw new PricingError("startStageId must come before endStageId in sequence.");
  }

  const trackStages = await getTrackStages(trackId);
  const stagesInRange = trackStages.filter(
    (s) => s.sequenceOrder >= startStage.sequenceOrder && s.sequenceOrder <= endStage.sequenceOrder
  );
  if (stagesInRange.length === 0) {
    throw new PricingError("No stages found in the selected range for this track.");
  }

  const { total, breakdown } = await priceStages(stagesInRange, countryId);
  return { breakdown, total, journeyStartStageId: startStageId, journeyEndStageId: endStageId };
}

// Implements doc §6.1's calculate_order_price algorithm.
export async function calculateOrderPrice(params: {
  trackId: string;
  packageId?: string | null;
  startStageId?: string | null;
  endStageId?: string | null;
  countryId?: string | null;
}): Promise<PricingResult> {
  if (params.packageId) {
    return calculateFromPackage(params.packageId, params.countryId ?? null);
  }
  if (!params.startStageId || !params.endStageId) {
    throw new PricingError(
      "startStageId and endStageId are required when no packageId is given (custom journey)."
    );
  }
  return calculateCustomJourney(params.trackId, params.startStageId, params.endStageId, params.countryId ?? null);
}
