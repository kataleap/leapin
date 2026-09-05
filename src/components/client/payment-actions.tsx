"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PaymentActions({
  orderId,
  installmentNumber,
  bankDetails,
}: {
  orderId: string;
  installmentNumber: number;
  bankDetails: { bankName: string; accountName: string; iban: string };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "bank_transfer">("choose");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function payOnline() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/payments/${installmentNumber}/checkout`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر إنشاء رابط الدفع.");
        return;
      }
      window.location.href = data.checkoutUrl;
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadProof(file: File) {
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch(`/api/orders/${orderId}/payments/${installmentNumber}/bank-transfer`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر رفع الإيصال.");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "choose") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={submitting} onClick={payOnline}>
          الدفع الإلكتروني
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={submitting} onClick={() => setMode("bank_transfer")}>
          تحويل بنكي
        </Button>
        {error && <p className="text-destructive w-full text-xs" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">بيانات التحويل البنكي</p>
      <dl className="text-muted-foreground space-y-1 text-xs">
        <div>البنك: {bankDetails.bankName}</div>
        <div>اسم الحساب: {bankDetails.accountName}</div>
        <div>الآيبان: {bankDetails.iban}</div>
      </dl>
      <label className="text-sm">
        <span className="mb-1 block">ارفع إيصال التحويل</span>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          disabled={submitting}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadProof(file);
          }}
        />
      </label>
      <Button type="button" size="sm" variant="ghost" onClick={() => setMode("choose")}>
        رجوع
      </Button>
      {error && <p className="text-destructive text-xs" role="alert">{error}</p>}
    </div>
  );
}
