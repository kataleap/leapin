import { describe, it, expect, vi, beforeEach } from "vitest";

// These three are the module's only side-effecting dependencies. Mocking them
// keeps the suite about the decision logic — which transitions are allowed —
// with no database in the loop.
const findUnique = vi.fn();
const update = vi.fn();
const logAudit = vi.fn();
const createNotification = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { orderPayment: { findUnique: (...a: unknown[]) => findUnique(...a), update: (...a: unknown[]) => update(...a) } },
}));
vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));
vi.mock("@/lib/notifications", () => ({
  createNotification: (...a: unknown[]) => {
    createNotification(...a);
    return Promise.resolve();
  },
}));

const { applyPaymentStatusTransition } = await import("./apply-status-transition");

type Status = "pending" | "paid" | "failed" | "refunded";

function existingPayment(status: Status, amount = 1500) {
  return {
    id: "pay-1",
    orderId: "order-1",
    installmentNumber: 1,
    amount,
    status,
    paidAt: status === "paid" ? new Date("2026-01-01") : null,
    order: { clientId: "client-1" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...existingPayment("pending"), ...data })
  );
});

describe("applyPaymentStatusTransition", () => {
  // The full from/to matrix. Each row is a claim about money, so they are
  // spelled out rather than generated.
  const cases: Array<{ from: Status; to: "paid" | "failed" | "pending"; changes: boolean; why: string }> = [
    { from: "pending", to: "paid", changes: true, why: "the ordinary success path" },
    { from: "pending", to: "failed", changes: true, why: "the ordinary failure path" },
    { from: "pending", to: "pending", changes: false, why: "no news is not a transition" },
    { from: "paid", to: "paid", changes: false, why: "idempotent under gateway retries" },
    { from: "failed", to: "failed", changes: false, why: "idempotent under gateway retries" },
    { from: "failed", to: "paid", changes: true, why: "a retried attempt may legitimately succeed" },
    { from: "refunded", to: "paid", changes: false, why: "refunded is terminal" },
    { from: "refunded", to: "failed", changes: false, why: "refunded is terminal" },
    // The regression this suite exists for.
    { from: "paid", to: "failed", changes: false, why: "a stale report must never un-pay a paid installment" },
  ];

  for (const { from, to, changes, why } of cases) {
    it(`${from} + gateway says ${to} => ${changes ? "writes" : "no-op"} (${why})`, async () => {
      findUnique.mockResolvedValue(existingPayment(from));

      const result = await applyPaymentStatusTransition("pay-1", { status: to }, "actor-1");

      expect(result.changed).toBe(changes);
      expect(update).toHaveBeenCalledTimes(changes ? 1 : 0);
    });
  }

  it("un-paying a paid installment would also strand it, since checkout only issues links while pending", async () => {
    findUnique.mockResolvedValue(existingPayment("paid"));

    const result = await applyPaymentStatusTransition("pay-1", { status: "failed" }, "actor-1");

    expect(result.orderPayment?.status).toBe("paid");
    expect(update).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("writes with a compare-and-swap on the status it read, not on id alone", async () => {
    findUnique.mockResolvedValue(existingPayment("pending"));

    await applyPaymentStatusTransition("pay-1", { status: "paid" }, "actor-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pay-1", status: "pending" } })
    );
  });

  it("treats a lost race (P2025) as a no-op rather than an error", async () => {
    findUnique.mockResolvedValue(existingPayment("pending"));
    const { Prisma } = await import("@/generated/prisma/client");
    update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("No record was found", { code: "P2025", clientVersion: "7.10.0" })
    );

    const result = await applyPaymentStatusTransition("pay-1", { status: "paid" }, "actor-1");

    expect(result.changed).toBe(false);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("notifies the client exactly once when a payment lands", async () => {
    findUnique.mockResolvedValue(existingPayment("pending"));

    await applyPaymentStatusTransition("pay-1", { status: "paid" }, "actor-1");

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "client-1", type: "payment_received" })
    );
  });

  it("returns a no-op for an unknown payment id", async () => {
    findUnique.mockResolvedValue(null);

    const result = await applyPaymentStatusTransition("nope", { status: "paid" }, "actor-1");

    expect(result).toEqual({ orderPayment: null, changed: false });
  });

  describe("amount reconciliation", () => {
    it("refuses to mark paid when the gateway reports a different amount", async () => {
      findUnique.mockResolvedValue(existingPayment("pending", 1500));

      const result = await applyPaymentStatusTransition("pay-1", { status: "paid", amount: 15 }, "actor-1");

      expect(result.changed).toBe(false);
      expect(update).not.toHaveBeenCalled();
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "reject_payment_amount_mismatch" })
      );
    });

    it("refuses to mark paid when the settlement is in another currency", async () => {
      findUnique.mockResolvedValue(existingPayment("pending", 1500));

      const result = await applyPaymentStatusTransition(
        "pay-1",
        { status: "paid", amount: 1500, currency: "USD" },
        "actor-1"
      );

      expect(result.changed).toBe(false);
      expect(update).not.toHaveBeenCalled();
    });

    it("accepts a matching amount in SAR", async () => {
      findUnique.mockResolvedValue(existingPayment("pending", 1500));

      const result = await applyPaymentStatusTransition(
        "pay-1",
        { status: "paid", amount: 1500, currency: "SAR" },
        "actor-1"
      );

      expect(result.changed).toBe(true);
    });

    it("compares in halalas so 2-decimal values don't miss by a float epsilon", async () => {
      findUnique.mockResolvedValue(existingPayment("pending", 1666.67));

      const result = await applyPaymentStatusTransition(
        "pay-1",
        { status: "paid", amount: 1666.67, currency: "SAR" },
        "actor-1"
      );

      expect(result.changed).toBe(true);
    });

    // Until the adapters are verified against live sandboxes, Moyasar reports
    // no amount at all — the check must not block the working path.
    it("still applies when the gateway reports no amount", async () => {
      findUnique.mockResolvedValue(existingPayment("pending", 1500));

      const result = await applyPaymentStatusTransition("pay-1", { status: "paid" }, "actor-1");

      expect(result.changed).toBe(true);
    });
  });
});
