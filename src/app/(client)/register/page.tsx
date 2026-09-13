"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { NATIONALITIES } from "@/lib/reference/nationalities";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [residencyStatus, setResidencyStatus] = useState<"resident" | "non_resident">("non_resident");
  const [nationalIdOrIqama, setNationalIdOrIqama] = useState("");
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
        body: JSON.stringify({
          name,
          email,
          phone,
          nationality,
          residencyStatus,
          // Empty means "not provided" — the field is optional, and an empty
          // string would fail the schema's min(1) rather than be ignored.
          nationalIdOrIqama: nationalIdOrIqama.trim() || undefined,
          password,
          confirmPassword,
        }),
      });

      if (res.status === 409) {
        setError("يوجد حساب مسجّل بهذا البريد الإلكتروني مسبقًا.");
        return;
      }
      if (!res.ok) {
        setError("تعذّر إنشاء الحساب. تحقّق من البيانات وحاول مجددًا.");
        return;
      }

      // A fresh account has never completed the mandatory first-login OTP
      // step, so auto-signing-in here would immediately hit that wall —
      // land on /login (with the email prefilled) and let its two-step
      // flow handle it instead of duplicating that logic here.
      router.push(`/login?email=${encodeURIComponent(email)}`);
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
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nationality">الجنسية</Label>
              <select
                id="nationality"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                required
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="" disabled>
                  اختر جنسيتك
                </option>
                {NATIONALITIES.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.nameAr}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                تحدّد جنسيتك الدول المتاحة لتأسيس شركة أجنبية بالوكالة.
              </p>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">صفة الإقامة</legend>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="residencyStatus"
                    value="non_resident"
                    checked={residencyStatus === "non_resident"}
                    onChange={() => setResidencyStatus("non_resident")}
                  />
                  <span>غير مقيم في السعودية</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="residencyStatus"
                    value="resident"
                    checked={residencyStatus === "resident"}
                    onChange={() => setResidencyStatus("resident")}
                  />
                  <span>مقيم في السعودية</span>
                </label>
              </div>
              <p className="text-muted-foreground text-xs">
                تحدّد ما إذا كانت رحلتك تتطلب خطاب عدم ممانعة.
              </p>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="nationalIdOrIqama">رقم الهوية أو الإقامة (اختياري)</Label>
              <Input
                id="nationalIdOrIqama"
                value={nationalIdOrIqama}
                onChange={(e) => setNationalIdOrIqama(e.target.value)}
                maxLength={30}
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
