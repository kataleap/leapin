import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus, OrderStageStatus, PaymentStatus } from "@/generated/prisma/enums";

// `orders.status` was written once at creation (`draft`) and never again, so
// `pending_payment` / `in_progress` / `completed` were dead enum values and a
// fully paid, fully delivered order still read "draft" to its client. The fix
// is deliberately *derived* rather than a hand-managed state machine: the
// order's status is a function of facts that already exist — its stages and
// its installments — so it cannot drift out of sync with them the way a
// separately-updated column does. Every write path that changes either fact
// calls recomputeOrderStatus in the same transaction.

// `cancelled` and `on_hold` are administrative decisions about an order, not
// conclusions drawn from its stages or payments. Nothing derived may overwrite
// them — an order put on hold must stay on hold even as a webhook settles a
// payment underneath it.
const MANUAL_STATUSES: OrderStatus[] = [OrderStatus.cancelled, OrderStatus.on_hold];

// Stage statuses that mean work on this order has actually begun. `blocked`
// counts: a blocked stage is started work that hit an obstacle, not work that
// never started.
const STARTED_STAGE_STATUSES: OrderStageStatus[] = [
  OrderStageStatus.in_progress,
  OrderStageStatus.waiting_on_client,
  OrderStageStatus.waiting_on_government,
  OrderStageStatus.blocked,
  OrderStageStatus.completed,
];

export type OrderStatusFacts = {
  currentStatus: OrderStatus;
  // Every order_stages row, including the `skipped` ones — filtering them out
  // is this module's job, not the caller's (doc §7.1: stages outside
  // [journeyStartStage, journeyEndStage] are excluded from progress).
  stages: { status: OrderStageStatus }[];
  payments: { status: PaymentStatus; dueAt: Date | null }[];
};

/**
 * The whole decision, as a pure function — no database, so it is exhaustively
 * testable (see order-status.test.ts).
 */
export function deriveOrderStatus(facts: OrderStatusFacts): OrderStatus {
  if (MANUAL_STATUSES.includes(facts.currentStatus)) return facts.currentStatus;

  const activeStages = facts.stages.filter((s) => s.status !== OrderStageStatus.skipped);
  const allStagesDone =
    activeStages.length > 0 && activeStages.every((s) => s.status === OrderStageStatus.completed);

  // An installment is outstanding once its trigger has fired (dueAt is set)
  // and it has not settled. `failed` counts as outstanding — the client still
  // owes it; `refunded` does not — that money's fate was decided by an admin.
  const hasOutstandingPayment = facts.payments.some(
    (p) => p.dueAt != null && (p.status === PaymentStatus.pending || p.status === PaymentStatus.failed)
  );

  // Deliberately *not* completed while money is still owed: the final
  // installment is typically triggered by the final stage completing, so
  // calling the order done at that moment would tell the client the journey
  // is over while the last payment is still unpaid.
  if (allStagesDone && !hasOutstandingPayment) return OrderStatus.completed;

  const workStarted = activeStages.some((s) => STARTED_STAGE_STATUSES.includes(s.status));
  const anyPaymentSettled = facts.payments.some((p) => p.status === PaymentStatus.paid);
  if (workStarted || anyPaymentSettled) return OrderStatus.in_progress;

  if (hasOutstandingPayment) return OrderStatus.pending_payment;

  // Nothing due, nothing paid, nothing started — an order awaiting its first
  // trigger (a custom journey with no payment plan sits here until an admin
  // moves its first stage).
  return OrderStatus.draft;
}

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Re-derives and persists one order's status. Safe to call on every write that
 * touches a stage or an installment, including when nothing actually changed.
 *
 * Pass the transaction client when the caller is inside `$transaction` — the
 * status must commit or roll back with the fact that caused it. Returns what
 * changed so the caller can emit notifications *after* its transaction
 * commits (see notifyOrderStatusChange).
 */
export async function recomputeOrderStatus(orderId: string, client: DbClient = prisma) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      clientId: true,
      orderStages: { select: { status: true } },
      orderPayments: { select: { status: true, dueAt: true } },
    },
  });
  if (!order) return { changed: false, status: null, previousStatus: null, clientId: null } as const;

  const next = deriveOrderStatus({
    currentStatus: order.status,
    stages: order.orderStages,
    payments: order.orderPayments,
  });
  if (next === order.status) {
    return { changed: false, status: next, previousStatus: order.status, clientId: order.clientId } as const;
  }

  // Compare-and-swap on the status we just read, matching the pattern the
  // payment and stage writers already use: a webhook and an admin action can
  // recompute the same order concurrently, and the loser must not re-announce
  // a transition the winner already made.
  const claimed = await client.order.updateMany({
    where: { id: orderId, status: order.status },
    data: { status: next },
  });
  if (claimed.count === 0) {
    return { changed: false, status: order.status, previousStatus: order.status, clientId: order.clientId } as const;
  }

  return { changed: true, status: next, previousStatus: order.status, clientId: order.clientId } as const;
}

/**
 * The client-facing half of a completion, kept separate so it always runs
 * after the caller's transaction has committed.
 *
 * In-app only, on purpose: Phase 4 (§5.1) fixes external email to exactly
 * three events — stage_completed, waiting_on_client, payment_due — and
 * notification_log.event_type is an enum of precisely those. Adding an
 * order-completion email means widening that enum in a migration, which is a
 * scope decision, not an implementation detail to slip in here.
 */
export async function notifyOrderStatusChange(
  result: Awaited<ReturnType<typeof recomputeOrderStatus>>,
  orderId: string
) {
  if (!result.changed || !result.clientId) return;
  if (result.status !== OrderStatus.completed) return;

  await createNotification({
    userId: result.clientId,
    type: "order_completed",
    title: "اكتمل طلبك",
    message: "اكتملت جميع مراحل طلبك وسُدّدت مستحقاته. يمكنك مراجعة مستنداتك من صفحة «مستنداتي».",
    orderId,
  }).catch(() => {});
}
