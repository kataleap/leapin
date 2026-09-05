import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { tradeNameUpdateSchema } from "@/lib/validation/admin-orders";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const before = await prisma.tradeName.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!(await canStaffAccessOrder(before.orderId, session))) {
    return NextResponse.json({ error: "This order is not assigned to you." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = tradeNameUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const tradeName = await prisma.tradeName.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    await logAudit({
      actorUserId: session.user.id,
      action: "update_trade_name",
      entityType: "trade_name",
      entityId: id,
      oldValue: before,
      newValue: tradeName,
    });
    return NextResponse.json({ tradeName });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
