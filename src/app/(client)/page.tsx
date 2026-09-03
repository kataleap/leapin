import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserRole } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-4 py-24 text-center">
      <div>
        <h1 className="text-3xl font-semibold">Leapin</h1>
        <p className="text-muted-foreground mt-2">
          منصة تراخيص وتأسيس الشركات للمستثمرين الأجانب
        </p>
      </div>

      {session?.user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground text-sm">
            مسجّل الدخول باسم {session.user.email}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {role === UserRole.client && (
              <>
                <Button nativeButton={false} render={<Link href="/journey">ابدأ رحلة جديدة</Link>} />
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/orders">طلباتي</Link>}
                />
              </>
            )}
            {(role === UserRole.admin || role === UserRole.super_admin) && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin">لوحة الأدمن</Link>}
              />
            )}
            {role === UserRole.super_admin && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/superadmin">لوحة السوبر أدمن</Link>}
              />
            )}
          </div>
          <SignOutButton />
        </div>
      ) : (
        <div className="flex gap-3">
          <Button nativeButton={false} render={<Link href="/register">إنشاء حساب</Link>} />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/login">تسجيل الدخول</Link>}
          />
        </div>
      )}
    </main>
  );
}
