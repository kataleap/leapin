import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { paymentPlanUpdateSchema } from "@/lib/validation/payment-plans";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const paymentPlan = await prisma.paymentPlan.findUnique({
    where: { id },
    include: { installments: true },
  });
  if (!paymentPlan) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ paymentPlan });
}

export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = paymentPlanUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { installments, ...data } = parsed.data;

  const before = await prisma.paymentPlan.findUnique({
    where: { id },
    include: { installments: true },
  });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const plan = await prisma.$transaction(async (tx) => {
      await tx.paymentPlan.update({
        where: { id },
        data: { ...data, installmentsCount: installments ? installments.length : undefined },
      });
      if (installments) {
        await tx.paymentInstallment.deleteMany({ where: { paymentPlanId: id } });
        await tx.paymentInstallment.createMany({
          data: installments.map((i) => ({ ...i, paymentPlanId: id })),
        });
      }
      return tx.paymentPlan.findUniqueOrThrow({
        where: { id },
        include: { installments: true },
      });
    });
    await logAudit({
      actorUserId: session.user.id,
      action: "update_payment_plan",
      entityType: "payment_plan",
      entityId: id,
      oldValue: before,
      newValue: plan,
    });
    return NextResponse.json({ paymentPlan: plan });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const before = await prisma.paymentPlan.findUnique({
    where: { id },
    include: { installments: true },
  });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await prisma.$transaction([
      prisma.paymentInstallment.deleteMany({ where: { paymentPlanId: id } }),
      prisma.paymentPlan.delete({ where: { id } }),
    ]);
    await logAudit({
      actorUserId: session.user.id,
      action: "delete_payment_plan",
      entityType: "payment_plan",
      entityId: id,
      oldValue: before,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
