import { ActivityMixingRuleForm } from "@/components/superadmin/activity-mixing-rule-form";

export default function NewActivityMixingRulePage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة قاعدة دمج</h1>
      <ActivityMixingRuleForm />
    </div>
  );
}
