import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { handlePrismaError } from "@/lib/api-errors";
import { orderCreateSchema } from "@/lib/validation/journey";
import { calculateOrderPrice, getTrackStages, PricingError } from "@/lib/pricing/engine";
import { buildOrderPayments } from "@/lib/pricing/payment-plan";
import { notifySuperAdmins } from "@/lib/notifications";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET() {
  const { session, response } = await requireAuth();
  if (response) return response;

  // Clients see only their own orders; staff see everything (per-admin
  // assignment scoping is an admin-panel concern, a later step).
  const orders = await prisma.order.findMany({
    where: session.user.role === UserRole.client ? { clientId: session.user.id } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = orderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { trackId, packageId, startStageId, endStageId, countryId, activityCategoryId, paymentPlanId } =
    parsed.data;

  try {
    const pricing = await calculateOrderPrice({ trackId, packageId, startStageId, endStageId, countryId });

    // doc §7.1: every stage of the track gets an order_stages row — inside
    // [journeyStartStage, journeyEndStage] starts `not_started`, everything
    // else starts `skipped` (excluded from progress tracking).
    const trackStages = await getTrackStages(trackId);
    const startSeq = trackStages.find((s) => s.id === pricing.journeyStartStageId)?.sequenceOrder;
    const endSeq = trackStages.find((s) => s.id === pricing.journeyEndStageId)?.sequenceOrder;
    if (startSeq === undefined || endSeq === undefined) {
      throw new PricingError("Journey start/end stage does not belong to this track.");
    }

    const paymentRows = paymentPlanId ? await buildOrderPayments(paymentPlanId, pricing.total) : [];

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          clientId: session.user.id,
          trackId,
          activityCategoryId: activityCategoryId ?? null,
          selectedPackageId: packageId ?? null,
          journeyStartStageId: pricing.journeyStartStageId,
          journeyEndStageId: pricing.journeyEndStageId,
          paymentPlanId: paymentPlanId ?? null,
          status: "draft",
          totalPrice: pricing.total,
        },
      });

      await tx.orderStage.createMany({
        data: trackStages.map((stage) => ({
          orderId: created.id,
          stageId: stage.id,
          status: stage.sequenceOrder >= startSeq && stage.sequenceOrder <= endSeq ? "not_started" : "skipped",
        })),
      });

      if (paymentRows.length > 0) {
        await tx.orderPayment.createMany({
          data: paymentRows.map((p) => ({ ...p, orderId: created.id })),
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: { orderStages: true, orderPayments: true },
      });
    });

    // Doc §10.2: notify admins when a new order arrives so a super_admin can
    // assign it. A side effect of order creation, not part of its outcome —
    // failing to notify must never fail the order itself.
    await notifySuperAdmins({
      type: "order_created",
      title: "طلب جديد بحاجة لإسناد",
      message: `طلب جديد من ${session.user.email} بقيمة ${pricing.total.toLocaleString("ar-SA")} ريال.`,
      orderId: order.id,
    }).catch(() => {});

    return NextResponse.json({ order, breakdown: pricing.breakdown }, { status: 201 });
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
