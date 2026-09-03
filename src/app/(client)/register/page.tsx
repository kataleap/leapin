"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import type { UserRole } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const ROLE_HOME: Record<UserRole, string> = {
  client: "/",
  admin: "/admin",
  super_admin: "/superadmin",
};

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      if (res.status === 409) {
        setError("يوجد حساب مسجّل بهذا البريد الإلكتروني مسبقًا.");
        return;
      }
      if (!res.ok) {
        setError("تعذّر إنشاء الحساب. تحقّق من البيانات وحاول مجددًا.");
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result || !result.ok) {
        setError("تم إنشاء الحساب، لكن تعذّر تسجيل الدخول تلقائيًا — جرّب تسجيل الدخول يدويًا.");
        return;
      }
      const session = await getSession();
      const role = session?.user?.role as UserRole | undefined;
      router.push(role ? ROLE_HOME[role] : "/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>إنشاء حساب</CardTitle>
          <CardDescription>سجّل بياناتك لإنشاء حساب عميل جديد</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">الاسم</Label>
              <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "جارٍ الإنشاء..." : "إنشاء حساب"}
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="text-primary underline">
              تسجيل الدخول
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
