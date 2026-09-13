import { describe, it, expect } from "vitest";
import { deriveOrderStatus, type OrderStatusFacts } from "./order-status";
import { OrderStatus, OrderStageStatus, PaymentStatus } from "@/generated/prisma/enums";

// deriveOrderStatus is pure by design, so the whole decision table is testable
// with no database — the same policy the rest of this suite follows.

const NOW = new Date("2026-09-05T12:00:00.000Z");

function facts(overrides: Partial<OrderStatusFacts> = {}): OrderStatusFacts {
  return {
    currentStatus: OrderStatus.draft,
    stages: [],
    payments: [],
    ...overrides,
  };
}

const due = (status: PaymentStatus) => ({ status, dueAt: NOW });
const notYetDue = (status: PaymentStatus) => ({ status, dueAt: null });

describe("deriveOrderStatus", () => {
  it("is draft when nothing is due, paid, or started", () => {
    expect(
      deriveOrderStatus(
        facts({
          stages: [{ status: OrderStageStatus.not_started }, { status: OrderStageStatus.not_started }],
          payments: [notYetDue(PaymentStatus.pending)],
        })
      )
    ).toBe(OrderStatus.draft);
  });

  it("is draft for a custom journey with no payment plan and no work started", () => {
    expect(deriveOrderStatus(facts({ stages: [{ status: OrderStageStatus.not_started }] }))).toBe(
      OrderStatus.draft
    );
  });

  it("is pending_payment once an installment's trigger has fired", () => {
    expect(
      deriveOrderStatus(
        facts({
          stages: [{ status: OrderStageStatus.not_started }],
          payments: [due(PaymentStatus.pending), notYetDue(PaymentStatus.pending)],
        })
      )
    ).toBe(OrderStatus.pending_payment);
  });

  it("treats a failed installment as still outstanding", () => {
    expect(
      deriveOrderStatus(
        facts({ stages: [{ status: OrderStageStatus.not_started }], payments: [due(PaymentStatus.failed)] })
      )
    ).toBe(OrderStatus.pending_payment);
  });

  it("is in_progress once any installment is paid, before any stage moves", () => {
    expect(
      deriveOrderStatus(
        facts({
          currentStatus: OrderStatus.pending_payment,
          stages: [{ status: OrderStageStatus.not_started }],
          payments: [due(PaymentStatus.paid)],
        })
      )
    ).toBe(OrderStatus.in_progress);
  });

  it.each([
    OrderStageStatus.in_progress,
    OrderStageStatus.waiting_on_client,
    OrderStageStatus.waiting_on_government,
    OrderStageStatus.blocked,
  ])("is in_progress once a stage reaches %s, even with nothing paid", (stageStatus) => {
    expect(
      deriveOrderStatus(
        facts({
          stages: [{ status: stageStatus }, { status: OrderStageStatus.not_started }],
          payments: [due(PaymentStatus.pending)],
        })
      )
    ).toBe(OrderStatus.in_progress);
  });

  it("ignores skipped stages when judging completion", () => {
    expect(
      deriveOrderStatus(
        facts({
          currentStatus: OrderStatus.in_progress,
          stages: [
            { status: OrderStageStatus.skipped },
            { status: OrderStageStatus.completed },
            { status: OrderStageStatus.skipped },
          ],
          payments: [due(PaymentStatus.paid)],
        })
      )
    ).toBe(OrderStatus.completed);
  });

  it("is completed with no payment plan at all once every active stage is done", () => {
    expect(
      deriveOrderStatus(
        facts({ currentStatus: OrderStatus.in_progress, stages: [{ status: OrderStageStatus.completed }] })
      )
    ).toBe(OrderStatus.completed);
  });

  // The case the final installment creates: completing the last stage is what
  // makes that installment due, so "all stages done" and "all money in" happen
  // at different moments and only the second one means completed.
  it("stays in_progress while a triggered installment is still unpaid", () => {
    expect(
      deriveOrderStatus(
        facts({
          currentStatus: OrderStatus.in_progress,
          stages: [{ status: OrderStageStatus.completed }, { status: OrderStageStatus.completed }],
          payments: [due(PaymentStatus.paid), due(PaymentStatus.pending)],
        })
      )
    ).toBe(OrderStatus.in_progress);
  });

  it("completes when that last installment finally settles", () => {
    expect(
      deriveOrderStatus(
        facts({
          currentStatus: OrderStatus.in_progress,
          stages: [{ status: OrderStageStatus.completed }, { status: OrderStageStatus.completed }],
          payments: [due(PaymentStatus.paid), due(PaymentStatus.paid)],
        })
      )
    ).toBe(OrderStatus.completed);
  });

  it("does not count a refunded installment as outstanding", () => {
    expect(
      deriveOrderStatus(
        facts({
          currentStatus: OrderStatus.in_progress,
          stages: [{ status: OrderStageStatus.completed }],
          payments: [due(PaymentStatus.refunded)],
        })
      )
    ).toBe(OrderStatus.completed);
  });

  it("never treats an order with zero active stages as completed", () => {
    expect(
      deriveOrderStatus(
        facts({ stages: [{ status: OrderStageStatus.skipped }], payments: [due(PaymentStatus.paid)] })
      )
    ).toBe(OrderStatus.in_progress);
  });

  it.each([OrderStatus.cancelled, OrderStatus.on_hold])(
    "never derives away from the administrative status %s",
    (manual) => {
      expect(
        deriveOrderStatus(
          facts({
            currentStatus: manual,
            stages: [{ status: OrderStageStatus.completed }],
            payments: [due(PaymentStatus.paid)],
          })
        )
      ).toBe(manual);
    }
  );

  it("can move an order back out of completed when a payment is refunded and re-owed", () => {
    // A refund that leaves the installment `pending` again (an admin reversing
    // a mis-confirmed transfer) must reopen the order rather than leave it
    // reading "مكتمل" with money owed.
    expect(
      deriveOrderStatus(
        facts({
          currentStatus: OrderStatus.completed,
          stages: [{ status: OrderStageStatus.completed }],
          payments: [due(PaymentStatus.pending)],
        })
      )
    ).toBe(OrderStatus.in_progress);
  });
});
