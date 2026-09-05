import { ActivityMixingRuleForm } from "@/components/superadmin/activity-mixing-rule-form";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function NewActivityMixingRulePage() {
  await requirePageRole([UserRole.super_admin]);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة قاعدة دمج</h1>
      <ActivityMixingRuleForm />
    </div>
  );
}
