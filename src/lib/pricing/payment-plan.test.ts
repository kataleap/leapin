import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { paymentPlan: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

const { buildOrderPayments } = await import("./payment-plan");
const { PricingError } = await import("./engine");

function plan(percentages: number[], triggerTypes?: string[]) {
  return {
    id: "plan-1",
    installments: percentages.map((percentage, i) => ({
      installmentNumber: i + 1,
      percentage,
      triggerType: triggerTypes?.[i] ?? (i === 0 ? "on_registration" : "on_stage_complete"),
    })),
  };
}

const sum = (rows: Array<{ amount: number }>) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

beforeEach(() => vi.clearAllMocks());

describe("buildOrderPayments", () => {
  it("splits a clean total across two installments", async () => {
    findUnique.mockResolvedValue(plan([50, 50]));

    const rows = await buildOrderPayments("plan-1", 10_000);

    expect(rows.map((r) => r.amount)).toEqual([5000, 5000]);
  });

  // The property that actually matters: a client is never billed a different
  // total than the order says, whatever the split.
  it.each([
    { total: 100, pct: [33.33, 33.33, 33.34] },
    { total: 10_000, pct: [30, 30, 40] },
    { total: 7_777.77, pct: [33.33, 33.33, 33.34] },
    { total: 1, pct: [33.33, 33.33, 33.34] },
    { total: 12_345.67, pct: [25, 25, 25, 25] },
    { total: 999.99, pct: [10, 90] },
    { total: 0.03, pct: [33.33, 33.33, 33.34] },
  ])("installments sum to exactly the order total ($total split $pct)", async ({ total, pct }) => {
    findUnique.mockResolvedValue(plan(pct));

    const rows = await buildOrderPayments("plan-1", total);

    expect(sum(rows)).toBe(total);
  });

  it("puts the rounding remainder on the last installment, not the first", async () => {
    findUnique.mockResolvedValue(plan([33.33, 33.33, 33.34]));

    const rows = await buildOrderPayments("plan-1", 100);

    // 33.33 + 33.33 = 66.66 allocated; the last takes the rest.
    expect(rows.map((r) => r.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(sum(rows)).toBe(100);
  });

  it("keeps every amount at 2 decimal places", async () => {
    findUnique.mockResolvedValue(plan([33.33, 33.33, 33.34]));

    const rows = await buildOrderPayments("plan-1", 7_777.77);

    for (const row of rows) {
      expect(row.amount).toBe(Math.round(row.amount * 100) / 100);
    }
  });

  it("rejects a plan whose percentages do not sum to 100", async () => {
    findUnique.mockResolvedValue(plan([50, 40]));

    await expect(buildOrderPayments("plan-1", 10_000)).rejects.toBeInstanceOf(PricingError);
  });

  it("marks only on_registration installments due immediately", async () => {
    findUnique.mockResolvedValue(plan([50, 50], ["on_registration", "on_stage_complete"]));

    const rows = await buildOrderPayments("plan-1", 10_000);

    expect(rows[0].dueAt).toBeInstanceOf(Date);
    expect(rows[1].dueAt).toBeNull();
  });

  it("rejects a plan with no installments", async () => {
    findUnique.mockResolvedValue({ id: "plan-1", installments: [] });

    await expect(buildOrderPayments("plan-1", 10_000)).rejects.toBeInstanceOf(PricingError);
  });

  it("rejects an unknown plan", async () => {
    findUnique.mockResolvedValue(null);

    await expect(buildOrderPayments("nope", 10_000)).rejects.toBeInstanceOf(PricingError);
  });

  it("orders installments by number so the remainder lands on the true last one", async () => {
    findUnique.mockResolvedValue(plan([33.33, 33.33, 33.34]));

    await buildOrderPayments("plan-1", 100);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { installments: { orderBy: { installmentNumber: "asc" } } },
      })
    );
  });
});
