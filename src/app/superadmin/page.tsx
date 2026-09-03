import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function SuperAdminHomePage() {
  const session = await auth();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">لوحة السوبر أدمن</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          مسجّل الدخول باسم {session?.user?.email}
        </p>
      </div>
      <SignOutButton />
    </div>
  );
}
