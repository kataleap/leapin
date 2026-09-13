import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { resolveStaffOrderAccess } from "@/lib/orders/assignment";
import { logAudit } from "@/lib/audit";
import { confirmPaymentSchema } from "@/lib/validation/payments";
import { recomputeOrderStatus, notifyOrderStatusChange } from "@/lib/orders/order-status";
import { createNotification } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

// Confirms a bank-transfer proof, or records an in-person cash collection.
export async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const payment = await prisma.orderPayment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Phase 6 §4: an account carrying the accounting flag confirms manual
  // payments on any order, assigned or not. Note this widening stops here —
  // the refund handler next door and the Moyasar sync route still ask
  // canStaffAccessOrder, so an accountant cannot reach either.
  const access = await resolveStaffOrderAccess(payment.orderId, session);
  if (!access.canConfirmPayment) {
    return NextResponse.json({ error: "This order is not assigned to you." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = confirmPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (payment.dueAt == null || payment.status !== "pending") {
    return NextResponse.json({ error: "This installment is not currently payable." }, { status: 400 });
  }
  if (parsed.data.method === "bank_transfer" && !payment.proofStoragePath) {
    return NextResponse.json({ error: "No bank-transfer proof has been uploaded for this installment." }, { status: 400 });
  }

  // §4, the explicit carve-out: electronic payments are entirely outside
  // this permission's reach. An installment that already has a gateway
  // invoice against it may still be settled in cash by the admin who owns
  // the order — that is a real workflow and stays as it was — but an
  // accountant reaching in on assignment-free authority must not race the
  // Moyasar webhook for the same row.
  if (access.viaAccounting && payment.gatewayReference) {
    return NextResponse.json(
      { error: "This installment has an electronic payment in progress and is outside the accounting permission." },
      { status: 403 }
    );
  }

  // `status: "pending"` in the filter re-asserts, at write time, the check
  // made above against a row read moments earlier. Two admins confirming the
  // same transfer at once — or an admin confirming while the gateway webhook
  // lands — would otherwise both pass that check and both write.
  const confirmed = await prisma.orderPayment.updateMany({
    where: { id, status: "pending" },
    data: { status: "paid", paidAt: new Date(), method: parsed.data.method },
  });
  if (confirmed.count === 0) {
    return NextResponse.json(
      { error: "This installment was already updated by someone else. Reload and try again." },
      { status: 409 }
    );
  }
  const updated = await prisma.orderPayment.findUniqueOrThrow({ where: { id } });
  await logAudit({
    actorUserId: session.user.id,
    // §6: an action taken on accounting authority is tagged distinctly, so a
    // later review can tell it apart from an assigned admin's ordinary
    // executive confirmation without cross-referencing stage assignments
    // that may have changed since.
    action: access.viaAccounting ? "confirm_order_payment_via_accounting" : "confirm_order_payment",
    entityType: "order_payment",
    entityId: id,
    oldValue: payment,
    newValue: updated,
  });

  // This route settles a payment without going through
  // applyPaymentStatusTransition, so it owns the same follow-ups — including
  // this one, which it was missing entirely: a client paying by bank transfer
  // or in cash was never told their money had been received, while a client
  // paying online (whose settlement runs through the gateway path) always was.
  const order = await prisma.order.findUnique({
    where: { id: payment.orderId },
    select: { clientId: true },
  });
  if (order) {
    await createNotification({
      userId: order.clientId,
      type: "payment_received",
      title: "تم تأكيد دفعتك",
      message: `تم تأكيد استلام الدفعة رقم ${payment.installmentNumber} بنجاح.`,
      orderId: payment.orderId,
    }).catch(() => {});
  }

  const orderStatus = await recomputeOrderStatus(payment.orderId);
  await notifyOrderStatusChange(orderStatus, payment.orderId);

  return NextResponse.json({ orderPayment: updated, orderStatus: orderStatus.status });
}
