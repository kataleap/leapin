import { StageForm } from "@/components/superadmin/stage-form";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function NewStagePage() {
  await requirePageRole([UserRole.super_admin]);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة مرحلة</h1>
      <StageForm mode="create" />
    </div>
  );
}
