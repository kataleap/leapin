import { describe, it, expect, vi, beforeEach } from "vitest";

// The pricing engine is doc §6.1's calculate_order_price — the algorithm that
// decides what every client is charged — and it had no test at all. Its inputs
// are all reads, so mocking Prisma keeps the suite about the arithmetic and
// the rules, with no database in the loop (the same approach the payment
// suite takes).

const findUniqueTrack = vi.fn();
const findManyStage = vi.fn();
const findUniqueStage = vi.fn();
const findUniquePackage = vi.fn();
const findUniqueCountry = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    track: { findUnique: (...a: unknown[]) => findUniqueTrack(...a) },
    stage: {
      findMany: (...a: unknown[]) => findManyStage(...a),
      findUnique: (...a: unknown[]) => findUniqueStage(...a),
    },
    package: { findUnique: (...a: unknown[]) => findUniquePackage(...a) },
    country: { findUnique: (...a: unknown[]) => findUniqueCountry(...a) },
  },
}));

const { calculateOrderPrice, getTrackStages, PricingError } = await import("./engine");

type PricingRow = { pricingType: string; basePrice: number | null };

function stage(id: string, sequenceOrder: number, pricing: PricingRow[]) {
  return {
    id,
    code: id.toUpperCase(),
    nameAr: `مرحلة ${sequenceOrder}`,
    sequenceOrder,
    stagePricing: pricing,
  };
}

const fixed = (basePrice: number): PricingRow => ({ pricingType: "fixed", basePrice });
const byCountry: PricingRow = { pricingType: "variable_by_country", basePrice: null };
const bundled: PricingRow = { pricingType: "bundled_only", basePrice: null };
const byCategory: PricingRow = { pricingType: "variable_by_category", basePrice: null };

beforeEach(() => {
  vi.clearAllMocks();
  findUniqueTrack.mockResolvedValue({ id: "track-1", code: "regular_investment" });
  findUniqueCountry.mockResolvedValue({ id: "country-1", basePrice: 4500 });
});

function packageOf(stages: ReturnType<typeof stage>[], overrides: Record<string, unknown> = {}) {
  return {
    id: "pkg-1",
    code: "PKG_1",
    nameAr: "باقة",
    isActive: true,
    totalPriceOverride: null,
    discountType: "none",
    discountValue: null,
    packageStages: stages.map((s) => ({ stage: s })),
    ...overrides,
  };
}

describe("calculateOrderPrice — package pricing", () => {
  it("sums the fixed prices of the package's stages", async () => {
    findUniquePackage.mockResolvedValue(packageOf([stage("s1", 1, [fixed(2000)]), stage("s2", 2, [fixed(3000)])]));

    const result = await calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" });

    expect(result.total).toBe(5000);
    expect(result.breakdown.map((b) => b.price)).toEqual([2000, 3000]);
  });

  it("takes the journey's start and end from stage sequence, not from array order", async () => {
    findUniquePackage.mockResolvedValue(
      packageOf([stage("late", 9, [fixed(1000)]), stage("early", 2, [fixed(1000)])])
    );

    const result = await calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" });

    expect(result.journeyStartStageId).toBe("early");
    expect(result.journeyEndStageId).toBe("late");
  });

  it("adds the chosen country's price for a variable_by_country stage", async () => {
    findUniquePackage.mockResolvedValue(packageOf([stage("s1", 1, [fixed(2000)]), stage("s2", 2, [byCountry])]));

    const result = await calculateOrderPrice({
      trackId: "track-1",
      packageId: "pkg-1",
      countryId: "country-1",
    });

    expect(result.total).toBe(6500);
  });

  it("refuses to price a country-priced stage with no country chosen", async () => {
    findUniquePackage.mockResolvedValue(packageOf([stage("s1", 1, [byCountry])]));

    await expect(calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" })).rejects.toBeInstanceOf(
      PricingError
    );
  });

  it("reads the country once even when several stages are priced by it", async () => {
    findUniquePackage.mockResolvedValue(packageOf([stage("s1", 1, [byCountry]), stage("s2", 2, [byCountry])]));

    const result = await calculateOrderPrice({
      trackId: "track-1",
      packageId: "pkg-1",
      countryId: "country-1",
    });

    expect(result.total).toBe(9000);
    expect(findUniqueCountry).toHaveBeenCalledTimes(1);
  });

  it("skips bundled_only stages — they are priced inside another stage", async () => {
    findUniquePackage.mockResolvedValue(packageOf([stage("s1", 1, [fixed(2000)]), stage("s2", 2, [bundled])]));

    const result = await calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" });

    expect(result.total).toBe(2000);
    expect(result.breakdown).toHaveLength(1);
  });

  it("contributes nothing for variable_by_category, which the schema cannot yet price", async () => {
    findUniquePackage.mockResolvedValue(packageOf([stage("s1", 1, [fixed(2000)]), stage("s2", 2, [byCategory])]));

    const result = await calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" });

    expect(result.total).toBe(2000);
  });

  it("uses total_price_override instead of summing stages", async () => {
    findUniquePackage.mockResolvedValue(
      packageOf([stage("s1", 1, [fixed(2000)]), stage("s2", 2, [fixed(3000)])], {
        totalPriceOverride: 4000,
      })
    );

    const result = await calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" });

    expect(result.total).toBe(4000);
    expect(result.breakdown).toHaveLength(1);
  });

  it("applies a percentage discount", async () => {
    findUniquePackage.mockResolvedValue(
      packageOf([stage("s1", 1, [fixed(10000)])], { discountType: "percentage", discountValue: 25 })
    );

    expect((await calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" })).total).toBe(7500);
  });

  it("applies a fixed-amount discount", async () => {
    findUniquePackage.mockResolvedValue(
      packageOf([stage("s1", 1, [fixed(10000)])], { discountType: "fixed_amount", discountValue: 1500 })
    );

    expect((await calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" })).total).toBe(8500);
  });

  it("never lets a discount larger than the price produce a negative total", async () => {
    findUniquePackage.mockResolvedValue(
      packageOf([stage("s1", 1, [fixed(1000)])], { discountType: "fixed_amount", discountValue: 5000 })
    );

    expect((await calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" })).total).toBe(0);
  });

  it("discounts the override too, not only a summed price", async () => {
    findUniquePackage.mockResolvedValue(
      packageOf([stage("s1", 1, [fixed(9999)])], {
        totalPriceOverride: 10000,
        discountType: "percentage",
        discountValue: 10,
      })
    );

    expect((await calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" })).total).toBe(9000);
  });

  it("rejects an inactive package", async () => {
    findUniquePackage.mockResolvedValue(packageOf([stage("s1", 1, [fixed(1000)])], { isActive: false }));

    await expect(calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" })).rejects.toThrow(
      /not active/
    );
  });

  it("rejects a package with no stages configured", async () => {
    findUniquePackage.mockResolvedValue(packageOf([]));

    await expect(calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" })).rejects.toThrow(
      /no stages/
    );
  });

  it("rejects an unknown package", async () => {
    findUniquePackage.mockResolvedValue(null);

    await expect(calculateOrderPrice({ trackId: "track-1", packageId: "pkg-1" })).rejects.toThrow(
      /Package not found/
    );
  });
});

describe("calculateOrderPrice — custom journey", () => {
  const trackStages = [
    stage("s1", 1, [fixed(1000)]),
    stage("s2", 2, [fixed(2000)]),
    stage("s3", 3, [fixed(4000)]),
  ];

  beforeEach(() => {
    findManyStage.mockResolvedValue(trackStages);
    findUniqueStage.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(trackStages.find((s) => s.id === where.id) ?? null)
    );
  });

  it("prices only the stages inside the chosen range, inclusive of both ends", async () => {
    const result = await calculateOrderPrice({
      trackId: "track-1",
      startStageId: "s1",
      endStageId: "s2",
    });

    expect(result.total).toBe(3000);
    expect(result.breakdown.map((b) => b.stageId)).toEqual(["s1", "s2"]);
  });

  it("prices a single-stage journey", async () => {
    const result = await calculateOrderPrice({
      trackId: "track-1",
      startStageId: "s2",
      endStageId: "s2",
    });

    expect(result.total).toBe(2000);
  });

  it("rejects a range that runs backwards", async () => {
    await expect(
      calculateOrderPrice({ trackId: "track-1", startStageId: "s3", endStageId: "s1" })
    ).rejects.toThrow(/must come before/);
  });

  it("requires both ends of the range when no package is given", async () => {
    await expect(calculateOrderPrice({ trackId: "track-1", startStageId: "s1" })).rejects.toThrow(
      /startStageId and endStageId are required/
    );
  });

  it("rejects a stage id that does not exist", async () => {
    await expect(
      calculateOrderPrice({ trackId: "track-1", startStageId: "ghost", endStageId: "s2" })
    ).rejects.toThrow(/Invalid startStageId/);
  });
});

describe("getTrackStages", () => {
  it("asks for the track's own stages plus the shared ones", async () => {
    findManyStage.mockResolvedValue([]);

    await getTrackStages("track-1");

    expect(findManyStage).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ trackScope: "shared" }, { trackScope: "regular_only" }] },
        orderBy: { sequenceOrder: "asc" },
      })
    );
  });

  it("maps the entrepreneurship track to its own scope", async () => {
    findUniqueTrack.mockResolvedValue({ id: "track-2", code: "entrepreneurship" });
    findManyStage.mockResolvedValue([]);

    await getTrackStages("track-2");

    expect(findManyStage).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ trackScope: "shared" }, { trackScope: "entrepreneurship_only" }] },
      })
    );
  });

  // The mapping is an explicit assumption in the engine, not a schema
  // relationship — a third track must fail loudly rather than price as if it
  // had no stages of its own.
  it("refuses an unmapped track code instead of silently pricing nothing", async () => {
    findUniqueTrack.mockResolvedValue({ id: "track-3", code: "regional_hq" });

    await expect(getTrackStages("track-3")).rejects.toThrow(/No stage-scope mapping/);
  });

  it("rejects an unknown track", async () => {
    findUniqueTrack.mockResolvedValue(null);

    await expect(getTrackStages("ghost")).rejects.toThrow(/Track not found/);
  });
});
