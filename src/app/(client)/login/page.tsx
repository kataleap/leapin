"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

type View = "password" | "forgot" | "otp";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("password");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function completeSignIn(result: Awaited<ReturnType<typeof signIn>>) {
    if (!result || !result.ok) {
      setError("الرمز غير صحيح أو منتهي الصلاحية.");
      return;
    }
    const session = await getSession();
    const role = session?.user?.role as UserRole | undefined;
    router.push(role ? ROLE_HOME[role] : "/");
    router.refresh();
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login/password-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);

      if (!data?.ok) {
        setError(
          data?.reason === "no_phone"
            ? "لا يوجد رقم هاتف مسجَّل على هذا الحساب. يرجى التواصل مع الإدارة."
            : "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        );
        return;
      }

      if (!data.otpRequired) {
        const result = await signIn("credentials", { email, password, redirect: false });
        await completeSignIn(result);
        return;
      }

      setChallengeId(data.challengeId);
      setView("otp");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      setChallengeId(data?.challengeId ?? null);
      setView("otp");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn("otp", { challengeId, code, redirect: false });
      await completeSignIn(result);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>تسجيل الدخول</CardTitle>
        <CardDescription>
          {view === "otp" ? "أدخل رمز التحقق المُرسل إلى هاتفك المسجَّل" : "أدخل بيانات حسابك للمتابعة"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {view === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
            <button
              type="button"
              onClick={() => {
                setError(null);
                setView("forgot");
              }}
              className="text-primary block text-center text-sm underline"
            >
              نسيت كلمة المرور؟ الدخول برمز عبر الهاتف
            </button>
          </form>
        )}

        {view === "forgot" && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">البريد الإلكتروني</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}
            </Button>
            <button
              type="button"
              onClick={() => setView("password")}
              className="text-primary block text-center text-sm underline"
            >
              العودة لتسجيل الدخول بكلمة المرور
            </button>
          </form>
        )}

        {view === "otp" && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">رمز التحقق</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                required
              />
            </div>
            {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "جارٍ التحقق..." : "تأكيد"}
            </Button>
          </form>
        )}

        <p className="text-muted-foreground mt-4 text-center text-sm">
          ليس لديك حساب؟{" "}
          <Link href="/register" className="text-primary underline">
            إنشاء حساب
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm items-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
