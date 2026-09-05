import { UserRole } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function SuperAdminHomePage() {
  const session = await requirePageRole([UserRole.super_admin]);

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">لوحة السوبر أدمن</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          مسجّل الدخول باسم {session.user.email}
        </p>
      </div>
      <SignOutButton />
    </div>
  );
}
