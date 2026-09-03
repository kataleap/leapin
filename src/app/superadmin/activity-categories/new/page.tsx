import { ActivityCategoryForm } from "@/components/superadmin/activity-category-form";

export default function NewActivityCategoryPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة فئة نشاطية</h1>
      <ActivityCategoryForm mode="create" />
    </div>
  );
}
