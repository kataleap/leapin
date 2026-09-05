"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ProfileFormValues = {
  name: string;
  email: string;
  phone: string;
  nationality: string;
  addressCountry: string;
  addressCity: string;
  addressPostalCode: string;
};

export function ProfileForm({
  role,
  initial,
  pendingPhone,
}: {
  role: UserRole;
  initial: ProfileFormValues;
  pendingPhone: string | null;
}) {
  const router = useRouter();
  const isClient = role === "client";
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Set only after a PUT reports the phone actually changed (doc §3.3) —
  // the old phone stays authoritative until this challenge is verified.
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [awaitingPhone, setAwaitingPhone] = useState(pendingPhone);

  function set<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = isClient
        ? values
        : { name: values.name, email: values.email, phone: values.phone };
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر حفظ التغييرات.");
        return;
      }
      if (data.phoneChangePending) {
        setChallengeId(data.challengeId);
        setAwaitingPhone(values.phone);
      } else {
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setOtpError(null);
    setVerifying(true);
    try {
      const res = await fetch("/api/profile/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setOtpError("الرمز غير صحيح أو منتهي الصلاحية.");
        return;
      }
      setChallengeId(null);
      setCode("");
      setAwaitingPhone(null);
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">الاسم الكامل</Label>
          <Input id="name" value={values.name} onChange={(e) => set("name", e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">رقم الهاتف</Label>
          <Input id="phone" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} required />
          {awaitingPhone && (
            <p className="text-muted-foreground text-xs">
              بانتظار التحقق من الرقم الجديد ({awaitingPhone}) — الرقم الحالي أعلاه يبقى ساريًا حتى إتمام التحقق.
            </p>
          )}
        </div>

        {isClient && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="nationality">الجنسية</Label>
              <Input
                id="nationality"
                value={values.nationality}
                onChange={(e) => set("nationality", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="addressCountry">الدولة</Label>
                <Input
                  id="addressCountry"
                  value={values.addressCountry}
                  onChange={(e) => set("addressCountry", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="addressCity">المدينة</Label>
                <Input
                  id="addressCity"
                  value={values.addressCity}
                  onChange={(e) => set("addressCity", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="addressPostalCode">الرمز البريدي</Label>
                <Input
                  id="addressPostalCode"
                  value={values.addressPostalCode}
                  onChange={(e) => set("addressPostalCode", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "جارٍ الحفظ..." : "حفظ التغييرات"}
        </Button>
      </form>

      {challengeId && (
        <form onSubmit={handleVerifyPhone} className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">تأكيد رقم الهاتف الجديد</p>
          <p className="text-muted-foreground text-sm">
            أدخل رمز التحقق المُرسل إلى {awaitingPhone}.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="phone-otp">رمز التحقق</Label>
            <Input
              id="phone-otp"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
            />
          </div>
          {otpError && <p className="text-destructive text-sm" role="alert">{otpError}</p>}
          <Button type="submit" size="sm" disabled={verifying}>
            {verifying ? "جارٍ التحقق..." : "تأكيد الرقم"}
          </Button>
        </form>
      )}
    </div>
  );
}
