import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { logAudit } from "@/lib/audit";
import { refundPaymentSchema } from "@/lib/validation/payments";

type Params = { params: Promise<{ id: string }> };

// Manual refund recording (doc §6.2) — the actual refund happens in the
// gateway's own dashboard, outside this platform; this just records it.
export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const payment = await prisma.orderPayment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!(await canStaffAccessOrder(payment.orderId, session))) {
    return NextResponse.json({ error: "This order is not assigned to you." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = refundPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }
  if (payment.status !== "paid") {
    return NextResponse.json({ error: "Only a paid installment can be marked refunded." }, { status: 409 });
  }

  // Compare-and-swap, same reasoning as the confirm route: the `paid` check
  // above is against a stale read until it is re-asserted in the write.
  const refunded = await prisma.orderPayment.updateMany({
    where: { id, status: "paid" },
    data: { status: "refunded" },
  });
  if (refunded.count === 0) {
    return NextResponse.json(
      { error: "This installment was already updated by someone else. Reload and try again." },
      { status: 409 }
    );
  }
  const updated = await prisma.orderPayment.findUniqueOrThrow({ where: { id } });
  await logAudit({
    actorUserId: session.user.id,
    action: "refund_order_payment",
    entityType: "order_payment",
    entityId: id,
    oldValue: payment,
    newValue: updated,
  });

  return NextResponse.json({ orderPayment: updated });
}
