import { prisma } from "@/lib/prisma";
import { PricingError } from "@/lib/pricing/engine";

// Implements doc §6.3: once `total` is computed, the linked payment plan
// splits it across its installments, creating `pending` order_payments —
// actual gateway settlement (marking them `paid`) is a separate, later step.
export async function buildOrderPayments(paymentPlanId: string, total: number) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: paymentPlanId },
    include: { installments: true },
  });
  if (!plan) throw new PricingError("Payment plan not found.");
  if (plan.installments.length === 0) {
    throw new PricingError("This payment plan has no installments configured.");
  }

  return plan.installments.map((installment) => ({
    paymentPlanId: plan.id,
    installmentNumber: installment.installmentNumber,
    amount: Math.round(total * (Number(installment.percentage) / 100) * 100) / 100,
    status: "pending" as const,
  }));
}
