import { PaymentPlanForm } from "@/components/superadmin/payment-plan-form";

export default function NewPaymentPlanPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة خطة دفع</h1>
      <PaymentPlanForm mode="create" />
    </div>
  );
}
