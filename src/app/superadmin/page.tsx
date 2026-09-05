import { UserRole } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/auth/require-page-role";

export default async function SuperAdminHomePage() {
  const session = await requirePageRole([UserRole.super_admin]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">لوحة السوبر أدمن</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        مسجّل الدخول باسم {session.user.email}
      </p>
    </div>
  );
}
