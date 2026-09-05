import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PaymentPlanForm } from "@/components/superadmin/payment-plan-form";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };

export default async function EditPaymentPlanPage({ params }: Params) {
  await requirePageRole([UserRole.super_admin]);

  const { id } = await params;
  const plan = await prisma.paymentPlan.findUnique({
    where: { id },
    include: { installments: { orderBy: { installmentNumber: "asc" } } },
  });
  if (!plan) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">تعديل خطة دفع: {plan.code}</h1>
      <PaymentPlanForm
        mode="edit"
        planId={plan.id}
        initial={{
          ownerType: plan.ownerType,
          ownerId: plan.ownerId,
          code: plan.code,
          isDefault: plan.isDefault,
          isClientSelectable: plan.isClientSelectable,
          installments: plan.installments.map((i) => ({
            percentage: Number(i.percentage),
            triggerType: i.triggerType,
            triggerStageId: i.triggerStageId,
          })),
        }}
      />
    </div>
  );
}
