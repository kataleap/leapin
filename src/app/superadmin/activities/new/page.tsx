import { ActivityForm } from "@/components/superadmin/activity-form";

export default function NewActivityPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة نشاط</h1>
      <ActivityForm mode="create" />
    </div>
  );
}
