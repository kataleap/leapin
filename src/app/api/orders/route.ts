import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { baseUrl } from "@/lib/env";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { handlePrismaError } from "@/lib/api-errors";
import { orderCreateSchema } from "@/lib/validation/journey";
import { calculateOrderPrice, getTrackStages, PricingError } from "@/lib/pricing/engine";
import { buildOrderPayments } from "@/lib/pricing/payment-plan";
import { createNotification, notifySuperAdmins } from "@/lib/notifications";
import { recomputeOrderStatus } from "@/lib/orders/order-status";
import { missingProfileFields, PROFILE_FIELD_LABEL } from "@/lib/orders/journey-readiness";
import { isCountryEligibleFor } from "@/lib/orders/country-eligibility";
import { isNonObjectionLetterRequired } from "@/lib/orders/non-objection";
import { sendExternalNotification } from "@/lib/email/send-external-notification";

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
  const { trackId, packageId, startStageId, endStageId, countryId, activityCategoryId, activityIds, paymentPlanId } =
    parsed.data;

  try {
    // The journey page refuses to start without these, but the page is not the
    // gate — this endpoint is. An order created without a nationality on file
    // cannot have its country choice validated at all.
    const client = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { nationality: true, residencyStatus: true, phone: true, role: true },
    });
    if (!client) return NextResponse.json({ error: "Not found." }, { status: 404 });

    if (client.role === UserRole.client) {
      const missing = missingProfileFields(client);
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: `أكمل بيانات حسابك أولًا: ${missing.map((f) => PROFILE_FIELD_LABEL[f].label).join("، ")}.`,
            missingProfileFields: missing,
          },
          { status: 409 }
        );
      }
    }

    // A country the client's nationality is barred from is never offered by
    // the wizard; this is what makes that a rule rather than a rendering
    // choice (doc §5.1, country_nationality_restrictions).
    if (countryId) {
      const country = await prisma.country.findUnique({
        where: { id: countryId },
        include: { nationalityRestrictions: { select: { nationalityCode: true, isEligible: true } } },
      });
      if (!country || country.status !== "active") {
        return NextResponse.json({ error: "Country not found." }, { status: 400 });
      }
      if (!isCountryEligibleFor(country, client.nationality)) {
        return NextResponse.json(
          { error: "هذه الدولة غير متاحة لجنسيتك المسجَّلة." },
          { status: 409 }
        );
      }
    }

    // Defense in depth — the journey UI only ever offers activities from the
    // chosen category or an addable category per an `isAllowed` mixing rule,
    // but re-validate server-side since this is a state-changing endpoint.
    if (activityIds && activityIds.length > 0) {
      if (!activityCategoryId) {
        return NextResponse.json(
          { error: "activityCategoryId is required when activityIds is provided." },
          { status: 400 }
        );
      }
      const allowedCategoryIds = new Set([activityCategoryId]);
      const mixingRules = await prisma.activityMixingRule.findMany({
        where: { baseCategoryId: activityCategoryId, isAllowed: true },
      });
      for (const rule of mixingRules) allowedCategoryIds.add(rule.addableCategoryId);

      const activities = await prisma.activity.findMany({ where: { id: { in: activityIds } } });
      if (activities.length !== activityIds.length) {
        return NextResponse.json({ error: "One or more activityIds do not exist." }, { status: 400 });
      }
      const invalid = activities.some((a) => !allowedCategoryIds.has(a.categoryId));
      if (invalid) {
        return NextResponse.json(
          { error: "One or more activities do not belong to the selected category or an addable category." },
          { status: 400 }
        );
      }
    }

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

    // Phase 3: the client never picks a payment plan explicitly today — fall
    // back to the selected package's default, client-selectable plan (super
    // admin must configure one per sellable package for this to activate;
    // a custom-journey order with no packageId still gets no plan, unchanged
    // from before).
    let resolvedPaymentPlanId = paymentPlanId ?? null;
    if (!resolvedPaymentPlanId && packageId) {
      const defaultPlan = await prisma.paymentPlan.findFirst({
        where: { ownerType: "package", ownerId: packageId, isDefault: true },
      });
      resolvedPaymentPlanId = defaultPlan?.id ?? null;
    }

    const paymentRows = resolvedPaymentPlanId ? await buildOrderPayments(resolvedPaymentPlanId, pricing.total) : [];

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          clientId: session.user.id,
          trackId,
          activityCategoryId: activityCategoryId ?? null,
          selectedPackageId: packageId ?? null,
          journeyStartStageId: pricing.journeyStartStageId,
          journeyEndStageId: pricing.journeyEndStageId,
          paymentPlanId: resolvedPaymentPlanId,
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

      if (activityIds && activityIds.length > 0) {
        await tx.orderActivity.createMany({
          data: activityIds.map((activityId) => ({ orderId: created.id, activityId })),
        });
      }

      // The sponsor's no-objection letter (doc §5.2). The row is created for
      // every order, carrying the verdict rather than only existing when the
      // answer is yes — so "does this order need one?" is answered by the
      // order's own record, and the answer is frozen at creation. A client who
      // later leaves the country must not change what an in-flight order
      // required of them.
      await tx.nonObjectionLetter.create({
        data: {
          orderId: created.id,
          isRequired: isNonObjectionLetterRequired(client),
        },
      });

      // The row above is created `draft`; this derives what it actually is now
      // that its stages and installments exist — an order whose plan opens with
      // an on_registration installment is `pending_payment` from birth, not a
      // draft. Inside the transaction so the order is never briefly visible in
      // a status its own rows contradict.
      await recomputeOrderStatus(created.id, tx);

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          orderStages: true,
          orderPayments: true,
          orderActivities: true,
          client: { select: { email: true } },
        },
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

    // An on_registration installment (buildOrderPayments sets its dueAt to
    // "now" — see src/lib/pricing/payment-plan.ts) is payable immediately,
    // so the client is notified the same moment the order is created (same
    // trigger the stage route uses for an on_stage_complete installment —
    // Phase 4 doc §5.2 assumes this already happens).
    const base = baseUrl();
    for (const payment of order.orderPayments) {
      if (!payment.dueAt) continue;
      const paymentDueTitle = "دفعة مستحقة على طلبك";
      const paymentDueMessage = `أصبحت الدفعة رقم ${payment.installmentNumber} مستحقة الدفع. يرجى زيارة صفحة "مدفوعاتي" لإتمام السداد.`;
      await createNotification({
        userId: session.user.id,
        type: "payment_due",
        title: paymentDueTitle,
        message: paymentDueMessage,
        orderId: order.id,
      }).catch(() => {});
      // sendExternalNotification is contracted never to throw, but this is a
      // POST that has already committed an order — belt and braces, because
      // a 500 here would show the client a failure for an order that exists
      // and invite them to submit a duplicate.
      await sendExternalNotification({
        orderId: order.id,
        recipientEmail: order.client.email,
        eventType: "payment_due",
        title: paymentDueTitle,
        message: paymentDueMessage,
        link: `${base}/payments`,
      }).catch(() => {});
    }

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
