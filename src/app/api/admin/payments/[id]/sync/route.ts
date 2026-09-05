import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { getPaymentGateway, PaymentGatewayError } from "@/lib/payments";
import { applyPaymentStatusTransition } from "@/lib/payments/apply-status-transition";

type Params = { params: Promise<{ id: string }> };

// Manual reconciliation fallback in place of a Redis/BullMQ retry queue —
// pulls the gateway's current view of this payment on demand.
export async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const payment = await prisma.orderPayment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!(await canStaffAccessOrder(payment.orderId, session))) {
    return NextResponse.json({ error: "This order is not assigned to you." }, { status: 403 });
  }

  if (!payment.gatewayReference) {
    return NextResponse.json({ error: "No gateway reference to sync yet." }, { status: 400 });
  }

  let status;
  try {
    status = await getPaymentGateway().getPaymentStatus(payment.gatewayReference);
  } catch (err) {
    if (err instanceof PaymentGatewayError) {
      return NextResponse.json({ error: "تعذّرت مزامنة الحالة مع بوابة الدفع." }, { status: 502 });
    }
    throw err;
  }
  const { orderPayment } = await applyPaymentStatusTransition(payment.id, status, session.user.id);

  return NextResponse.json({ orderPayment: orderPayment ?? payment });
}
