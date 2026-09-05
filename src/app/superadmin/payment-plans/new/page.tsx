import { PaymentPlanForm } from "@/components/superadmin/payment-plan-form";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function NewPaymentPlanPage() {
  await requirePageRole([UserRole.super_admin]);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة خطة دفع</h1>
      <PaymentPlanForm mode="create" />
    </div>
  );
}
