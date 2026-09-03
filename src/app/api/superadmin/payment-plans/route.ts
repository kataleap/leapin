import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { paymentPlanCreateSchema } from "@/lib/validation/payment-plans";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const paymentPlans = await prisma.paymentPlan.findMany({ include: { installments: true } });
  return NextResponse.json({ paymentPlans });
}

export async function POST(request: Request) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = paymentPlanCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { installments, ...data } = parsed.data;

  try {
    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.paymentPlan.create({
        data: { ...data, installmentsCount: installments.length },
      });
      await tx.paymentInstallment.createMany({
        data: installments.map((i) => ({ ...i, paymentPlanId: created.id })),
      });
      return tx.paymentPlan.findUniqueOrThrow({
        where: { id: created.id },
        include: { installments: true },
      });
    });
    await logAudit({
      actorUserId: session.user.id,
      action: "create_payment_plan",
      entityType: "payment_plan",
      entityId: plan.id,
      newValue: plan,
    });
    return NextResponse.json({ paymentPlan: plan }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
