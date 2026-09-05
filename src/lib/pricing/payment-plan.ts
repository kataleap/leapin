import { prisma } from "@/lib/prisma";
import { PricingError } from "@/lib/pricing/engine";

// Implements doc §6.3: once `total` is computed, the linked payment plan
// splits it across its installments, creating `pending` order_payments —
// actual gateway settlement (marking them `paid`) is a separate, later step.
export async function buildOrderPayments(paymentPlanId: string, total: number) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: paymentPlanId },
    include: {
      // Explicit ordering matters: the last installment absorbs the rounding
      // remainder below, so "last" must mean the highest installment number
      // and not whatever order the database happened to return.
      installments: { orderBy: { installmentNumber: "asc" } },
    },
  });
  if (!plan) throw new PricingError("Payment plan not found.");
  if (plan.installments.length === 0) {
    throw new PricingError("This payment plan has no installments configured.");
  }

  // A plan whose parts don't add up to the whole would silently over- or
  // under-bill every order that uses it. Fail loudly at order-creation time
  // instead — the schema can't express this constraint (Decimal(5,2) per row,
  // no cross-row CHECK), so it has to live here.
  const totalPercentage = plan.installments.reduce((sum, i) => sum + Number(i.percentage), 0);
  if (Math.round(totalPercentage * 100) !== 100_00) {
    throw new PricingError(
      `Payment plan installments must sum to 100% — this plan sums to ${totalPercentage}%.`
    );
  }

  // Work in halalas. Rounding each installment independently and hoping the
  // parts add up does not survive thirds: 100.00 split 33.33/33.33/33.34
  // rounds to 99.99, and the order is quietly under-billed by a halala
  // forever. Instead every installment but the last is rounded, and the last
  // takes whatever remains — so the sum equals the order total exactly, by
  // construction rather than by luck.
  const totalHalalas = Math.round(total * 100);
  let allocatedHalalas = 0;

  const now = new Date();
  return plan.installments.map((installment, index) => {
    const isLast = index === plan.installments.length - 1;
    const halalas = isLast
      ? totalHalalas - allocatedHalalas
      : Math.round((totalHalalas * Number(installment.percentage)) / 100);
    allocatedHalalas += halalas;

    return {
      paymentPlanId: plan.id,
      installmentNumber: installment.installmentNumber,
      amount: halalas / 100,
      status: "pending" as const,
      // Phase 3: on_registration installments are payable immediately;
      // anything else (on_stage_complete, fixed_date, manual) stays inert
      // until its own trigger fires — see the stage-completion hook in the
      // stages PUT route.
      dueAt: installment.triggerType === "on_registration" ? now : null,
    };
  });
}
