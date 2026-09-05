import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import type { PaymentGatewayStatus } from "./adapter";

// Shared by both the webhook handler and the admin's manual "sync status"
// action, so idempotency/audit/notify logic lives in exactly one place.
export async function applyPaymentStatusTransition(
  orderPaymentId: string,
  result: { status: PaymentGatewayStatus; paidAt?: Date; amount?: number; currency?: string },
  actorUserId: string
) {
  const payment = await prisma.orderPayment.findUnique({
    where: { id: orderPaymentId },
    include: { order: { select: { clientId: true } } },
  });
  if (!payment) return { orderPayment: null, changed: false } as const;

  // Terminal states are never overwritten by a gateway status report.
  if (payment.status === "refunded") return { orderPayment: payment, changed: false } as const;
  if (result.status === "pending") return { orderPayment: payment, changed: false } as const;
  if (result.status === "paid" && payment.status === "paid") return { orderPayment: payment, changed: false } as const;
  if (result.status === "failed" && payment.status === "failed") return { orderPayment: payment, changed: false } as const;
  // `paid` is terminal against a *negative* report. Moyasar retries deliveries
  // and does not guarantee ordering, so a stale "failed" for an attempt the
  // client later completed can arrive after the "paid" that superseded it.
  // Honouring it would both lose the payment record and strand the
  // installment: the checkout route only issues a link while status is
  // "pending", so a downgraded row can never be paid again. A genuine
  // reversal is a refund, which is an explicit admin action.
  if (result.status === "failed" && payment.status === "paid") {
    return { orderPayment: payment, changed: false } as const;
  }

  // Never mark an installment paid on a settlement that doesn't match what we
  // billed. The gateway tells us an invoice reached "paid"; that alone says
  // nothing about how much arrived or in what currency. Compared in halalas
  // so two 2-decimal values never miss each other by a float epsilon.
  if (result.status === "paid" && result.amount !== undefined) {
    const expectedHalalas = Math.round(Number(payment.amount) * 100);
    const reportedHalalas = Math.round(result.amount * 100);
    const currencyMismatch = result.currency !== undefined && result.currency !== "SAR";
    if (expectedHalalas !== reportedHalalas || currencyMismatch) {
      // Left `pending` on purpose: this needs a human to reconcile against
      // the gateway dashboard, and the audit row is how they find it.
      await logAudit({
        actorUserId,
        action: "reject_payment_amount_mismatch",
        entityType: "order_payment",
        entityId: orderPaymentId,
        oldValue: { expectedAmount: payment.amount, expectedCurrency: "SAR" },
        newValue: { reportedAmount: result.amount, reportedCurrency: result.currency ?? null },
      });
      return { orderPayment: payment, changed: false } as const;
    }
  }

  const data =
    result.status === "paid"
      ? { status: "paid" as const, paidAt: result.paidAt ?? new Date() }
      : { status: "failed" as const };

  // Compare-and-swap on the status we just read: the webhook and the admin's
  // manual sync can run concurrently, and both would otherwise pass the
  // guards above against the same stale row and write twice — duplicating the
  // audit entry and the client's "payment received" notification.
  let updated;
  try {
    updated = await prisma.orderPayment.update({
      where: { id: orderPaymentId, status: payment.status },
      data,
    });
  } catch (err) {
    // P2025 = no row matched, i.e. a concurrent writer moved the status
    // between our read and our write. They completed the transition (and
    // emitted its audit/notification); ours is a no-op.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { orderPayment: payment, changed: false } as const;
    }
    throw err;
  }

  await logAudit({
    actorUserId,
    action: "update_order_payment_status",
    entityType: "order_payment",
    entityId: orderPaymentId,
    oldValue: payment,
    newValue: updated,
  });

  if (result.status === "paid") {
    await createNotification({
      userId: payment.order.clientId,
      type: "payment_received",
      title: "تم تأكيد دفعتك",
      message: `تم تأكيد استلام الدفعة رقم ${payment.installmentNumber} بنجاح.`,
      orderId: payment.orderId,
    }).catch(() => {});
  }

  return { orderPayment: updated, changed: true } as const;
}
