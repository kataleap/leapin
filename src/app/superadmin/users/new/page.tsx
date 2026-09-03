import { UserForm } from "@/components/superadmin/user-form";

export default function NewUserPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة مستخدم</h1>
      <UserForm mode="create" />
    </div>
  );
}
