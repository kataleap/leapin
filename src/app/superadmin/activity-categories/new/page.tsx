import { ActivityCategoryForm } from "@/components/superadmin/activity-category-form";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function NewActivityCategoryPage() {
  await requirePageRole([UserRole.super_admin]);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة فئة نشاطية</h1>
      <ActivityCategoryForm mode="create" />
    </div>
  );
}
