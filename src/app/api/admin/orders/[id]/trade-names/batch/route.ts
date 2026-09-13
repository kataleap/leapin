import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { tradeNameBatchSchema } from "@/lib/validation/admin-orders";
import { createTradeNameBatch } from "@/lib/orders/trade-names";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  const { id: orderId } = await params;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!(await canStaffAccessOrder(orderId, session))) {
    return NextResponse.json({ error: "This order is not assigned to you." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = tradeNameBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Shared with the client's own submission route so both land in one
    // batch sequence — see src/lib/orders/trade-names.ts.
    const tradeNames = await createTradeNameBatch(orderId, parsed.data.names);

    await logAudit({
      actorUserId: session.user.id,
      action: "submit_trade_name_batch",
      entityType: "order",
      entityId: orderId,
      newValue: tradeNames,
    });
    return NextResponse.json({ tradeNames }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
