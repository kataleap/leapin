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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result || !result.ok) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
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
          <CardTitle>تسجيل الدخول</CardTitle>
          <CardDescription>أدخل بيانات حسابك للمتابعة</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                required
              />
            </div>
            {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "جارٍ الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            ليس لديك حساب؟{" "}
            <Link href="/register" className="text-primary underline">
              إنشاء حساب
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
