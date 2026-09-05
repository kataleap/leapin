import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { tradeNameBatchSchema } from "@/lib/validation/admin-orders";

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
    const tradeNames = await prisma.$transaction(async (tx) => {
      const latest = await tx.tradeName.findFirst({
        where: { orderId },
        orderBy: { batchNumber: "desc" },
      });
      const batchNumber = (latest?.batchNumber ?? 0) + 1;
      const now = new Date();

      await tx.tradeName.createMany({
        data: parsed.data.names.map((nameAr, index) => ({
          orderId,
          nameAr,
          priorityRank: index + 1,
          batchNumber,
          status: "submitted",
          submittedAt: now,
        })),
      });
      return tx.tradeName.findMany({ where: { orderId, batchNumber }, orderBy: { priorityRank: "asc" } });
    });

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
