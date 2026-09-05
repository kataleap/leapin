import { PackageForm } from "@/components/superadmin/package-form";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function NewPackagePage() {
  await requirePageRole([UserRole.super_admin]);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة باقة</h1>
      <PackageForm mode="create" />
    </div>
  );
}
