import { StageForm } from "@/components/superadmin/stage-form";

export default function NewStagePage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة مرحلة</h1>
      <StageForm mode="create" />
    </div>
  );
}
