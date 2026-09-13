"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Phase 6 §5.4 — the only action on the accounting screen.
//
// No refund, no resend-payment-link, no status sync and no stage control:
// those live on the order page and stay behind the assignment rule. This
// component exists so that constraint is visible in one small file rather
// than enforced by remembering not to add buttons here.
export function AccountingConfirmButton({
  paymentId,
  method,
}: {
  paymentId: string;
  method: "bank_transfer" | "cash";
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const label = method === "bank_transfer" ? "تأكيد استلام هذه الحوالة؟" : "تسجيل هذه الدفعة كاش؟";
    if (!confirm(label)) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // The API answers in English; the screen speaks Arabic. A 409 here is
        // the expected outcome of two people confirming the same transfer, so
        // it gets its own wording rather than a generic failure.
        setError(res.status === 409 ? "حُدِّثت هذه الدفعة من مستخدم آخر. حدّث الصفحة." : (data?.error ?? "تعذّر التأكيد."));
        return;
      }
      router.refresh();
    } catch {
      setError("تعذّر الاتصال بالخادم.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" variant={method === "bank_transfer" ? "default" : "outline"} disabled={submitting} onClick={handleClick}>
        {submitting ? "جارٍ..." : method === "bank_transfer" ? "تأكيد استلام التحويل" : "تسجيل دفعة كاش"}
      </Button>
      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
