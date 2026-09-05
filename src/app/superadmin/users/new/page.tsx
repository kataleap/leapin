import { UserForm } from "@/components/superadmin/user-form";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function NewUserPage() {
  await requirePageRole([UserRole.super_admin]);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة مستخدم</h1>
      <UserForm mode="create" />
    </div>
  );
}
