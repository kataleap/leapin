import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { baseUrl } from "@/lib/env";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { getPaymentGateway, PaymentGatewayError } from "@/lib/payments";

type Params = { params: Promise<{ id: string; installmentNumber: string }> };

// Serves three callers: the client's post-registration auto-redirect, the
// client self-serving from "مدفوعاتي", and an admin's "resend link" action
// — all funnel through this one endpoint so Moyasar is only ever called
// from here.
export async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const { id: orderId, installmentNumber } = await params;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const isClientOwner = session.user.role === UserRole.client && order.clientId === session.user.id;
  const isStaff = session.user.role === UserRole.admin || session.user.role === UserRole.super_admin;
  if (!isClientOwner && !isStaff) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (isStaff && !(await canStaffAccessOrder(orderId, session))) {
    return NextResponse.json({ error: "This order is not assigned to you." }, { status: 403 });
  }

  const payment = await prisma.orderPayment.findUnique({
    where: { orderId_installmentNumber: { orderId, installmentNumber: Number(installmentNumber) } },
  });
  if (!payment) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (payment.dueAt == null || payment.status !== "pending") {
    return NextResponse.json({ error: "This installment is not currently payable." }, { status: 400 });
  }

  let checkoutUrl = payment.checkoutUrl;
  let gatewayReference = payment.gatewayReference;
  let updated = payment;

  if (!checkoutUrl || !gatewayReference) {
    const base = baseUrl();
    let result;
    try {
      result = await getPaymentGateway().createCheckout({
        orderPaymentId: payment.id,
        amount: Number(payment.amount),
        description: `دفعة رقم ${payment.installmentNumber} — طلب Leapin`,
        successUrl: `${base}/payments`,
        backUrl: `${base}/payments`,
      });
    } catch (err) {
      if (err instanceof PaymentGatewayError) {
        return NextResponse.json({ error: "تعذّر إنشاء رابط الدفع مع بوابة الدفع." }, { status: 502 });
      }
      throw err;
    }

    // Claim the row only if it still has no reference. Two concurrent callers
    // (a double-click, or the client and an admin's "resend link" at once)
    // both reach the gateway call above, so two invoices can exist; what must
    // never happen is the second one overwriting the first's reference. If it
    // did, and the client paid using the first URL — which they already have
    // in hand — the webhook's findUnique on gatewayReference would miss, and
    // it answers 200 so the gateway stops retrying: a real payment, silently
    // unrecorded. The loser of the claim discards its own invoice (unused,
    // it simply expires at the gateway) and returns the winner's URL, so
    // every caller is handed the one link the DB actually knows about.
    const claimed = await prisma.orderPayment.updateMany({
      where: { id: payment.id, gatewayReference: null },
      data: { checkoutUrl: result.checkoutUrl, gatewayReference: result.gatewayReference, method: "online" },
    });

    if (claimed.count === 0) {
      const existing = await prisma.orderPayment.findUniqueOrThrow({ where: { id: payment.id } });
      return NextResponse.json({ checkoutUrl: existing.checkoutUrl, orderPayment: existing });
    }

    checkoutUrl = result.checkoutUrl;
    gatewayReference = result.gatewayReference;
    updated = await prisma.orderPayment.findUniqueOrThrow({ where: { id: payment.id } });
    await logAudit({
      actorUserId: session.user.id,
      action: "create_payment_checkout",
      entityType: "order_payment",
      entityId: payment.id,
      newValue: { gatewayReference, checkoutUrl },
    });
  }

  // A staff-triggered resend should tell the client; the client's own
  // self-serve click doesn't need to notify themself.
  if (isStaff && !isClientOwner) {
    await createNotification({
      userId: order.clientId,
      type: "payment_due",
      title: "رابط دفع جديد",
      message: `أُرسل لك رابط دفع للدفعة رقم ${payment.installmentNumber}. زر صفحة "مدفوعاتي" لإتمام السداد.`,
      orderId,
    }).catch(() => {});
  }

  return NextResponse.json({ checkoutUrl, orderPayment: updated });
}
