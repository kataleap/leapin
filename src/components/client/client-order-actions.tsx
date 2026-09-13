"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CLIENT_UPLOADABLE_DOCUMENT_TYPES,
  CLIENT_DOCUMENT_TYPE_LABEL,
} from "@/lib/orders/client-actions";
import { NOL_STATUS_LABEL, NOL_STATUS_VARIANT, NOL_STATUS_HINT } from "@/lib/orders/non-objection";
import type { NonObjectionLetterStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";

type Verdict = { allowed: true } | { allowed: false; reason: string };

export type NonObjectionLetterView = {
  isRequired: boolean;
  status: NonObjectionLetterStatus;
  reviewNote: string | null;
  documentId: string | null;
  documentName: string | null;
};

export function ClientOrderActions({
  orderId,
  waitingStageNames,
  canUploadDocuments,
  canSubmitTradeNames,
  canSubmitNonObjectionLetter,
  nonObjectionLetter,
}: {
  orderId: string;
  waitingStageNames: string[];
  canUploadDocuments: Verdict;
  canSubmitTradeNames: Verdict;
  canSubmitNonObjectionLetter: Verdict;
  nonObjectionLetter: NonObjectionLetterView | null;
}) {
  const router = useRouter();

  // A required letter that is missing or rejected is the most urgent thing on
  // this page — it blocks the licence application itself — so it leads.
  const nolOutstanding =
    nonObjectionLetter?.isRequired &&
    (nonObjectionLetter.status === "not_submitted" || nonObjectionLetter.status === "rejected");

  const headline = [
    nolOutstanding ? "خطاب عدم الممانعة" : null,
    waitingStageNames.length > 0 ? `مراحل بانتظارك: ${waitingStageNames.join("، ")}` : null,
  ].filter(Boolean);

  return (
    <Card className={nolOutstanding || waitingStageNames.length > 0 ? "border-primary" : undefined}>
      <CardHeader>
        <CardTitle>المطلوب منك</CardTitle>
        <CardDescription>
          {headline.length > 0
            ? headline.join(" • ")
            : "لا يوجد إجراء مطلوب منك حاليًا — يمكنك مع ذلك إرفاق مستنداتك متى جهزت."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {nonObjectionLetter?.isRequired && (
          <>
            <NonObjectionLetterSection
              orderId={orderId}
              letter={nonObjectionLetter}
              verdict={canSubmitNonObjectionLetter}
              onDone={() => router.refresh()}
            />
            <Separator />
          </>
        )}
        <DocumentUpload orderId={orderId} verdict={canUploadDocuments} onDone={() => router.refresh()} />
        <Separator />
        <TradeNameSubmission orderId={orderId} verdict={canSubmitTradeNames} onDone={() => router.refresh()} />
      </CardContent>
    </Card>
  );
}

function NonObjectionLetterSection({
  orderId,
  letter,
  verdict,
  onDone,
}: {
  orderId: string;
  letter: NonObjectionLetterView;
  verdict: Verdict;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch(`/api/orders/${orderId}/non-objection-letter`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر رفع الخطاب.");
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">خطاب عدم الممانعة من صاحب العمل</h3>
        <Badge variant={NOL_STATUS_VARIANT[letter.status]}>{NOL_STATUS_LABEL[letter.status]}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">{NOL_STATUS_HINT[letter.status]}</p>

      {letter.status === "rejected" && letter.reviewNote && (
        <p className="text-destructive text-sm">سبب الرفض: {letter.reviewNote}</p>
      )}

      {letter.documentId && (
        <p className="text-sm">
          الخطاب المرفوع:{" "}
          <a
            href={`/api/documents/${letter.documentId}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {letter.documentName ?? "عرض الملف"}
          </a>
        </p>
      )}

      {verdict.allowed ? (
        <>
          <label className="block text-sm">
            <span className="mb-1 block">
              {letter.status === "rejected" ? "ارفع خطابًا بديلًا" : "ارفع الخطاب"}
            </span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={submitting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-muted-foreground text-xs">PDF أو صورة، بحد أقصى 15 ميغابايت.</p>
          {submitting && <p className="text-muted-foreground text-xs">جارٍ الرفع...</p>}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">{verdict.reason}</p>
      )}

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function DocumentUpload({
  orderId,
  verdict,
  onDone,
}: {
  orderId: string;
  verdict: Verdict;
  onDone: () => void;
}) {
  const [documentType, setDocumentType] =
    useState<(typeof CLIENT_UPLOADABLE_DOCUMENT_TYPES)[number]>("foreign_company_docs");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function upload(file: File) {
    setError(null);
    setDone(false);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("documentType", documentType);
      const res = await fetch(`/api/orders/${orderId}/documents`, { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر رفع المستند.");
        return;
      }
      setDone(true);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">إرفاق مستند</h3>
      {!verdict.allowed ? (
        <p className="text-muted-foreground text-sm">{verdict.reason}</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="documentType">نوع المستند</Label>
            <select
              id="documentType"
              value={documentType}
              onChange={(e) =>
                setDocumentType(e.target.value as (typeof CLIENT_UPLOADABLE_DOCUMENT_TYPES)[number])
              }
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {CLIENT_UPLOADABLE_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CLIENT_DOCUMENT_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block">اختر الملف</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={submitting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                // Clear the input so re-picking the same file fires onChange
                // again — otherwise a retry after a failed upload does nothing.
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-muted-foreground text-xs">PDF أو صورة، بحد أقصى 15 ميغابايت.</p>
          {submitting && <p className="text-muted-foreground text-xs">جارٍ الرفع...</p>}
          {done && <p className="text-xs text-green-700">تم رفع المستند وإشعار فريقنا.</p>}
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

const MAX_TRADE_NAMES = 10;

function TradeNameSubmission({
  orderId,
  verdict,
  onDone,
}: {
  orderId: string;
  verdict: Verdict;
  onDone: () => void;
}) {
  // Starts at one field, not five: the fixed-count form was the phase-2 bug
  // (§5.1) — one to ten names, the client decides how many.
  const [names, setNames] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const filled = names.map((n) => n.trim()).filter((n) => n.length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (filled.length === 0) {
      setError("أدخل اسمًا واحدًا على الأقل.");
      return;
    }
    if (new Set(filled).size !== filled.length) {
      setError("لا يمكن تكرار نفس الاسم داخل الدفعة الواحدة.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/trade-names`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: filled }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر تقديم الأسماء.");
        return;
      }
      setNames([""]);
      setDone(true);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">تقديم أسماء تجارية مقترحة</h3>
      {!verdict.allowed ? (
        <p className="text-muted-foreground text-sm">{verdict.reason}</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-muted-foreground text-xs">
            من اسم واحد وحتى عشرة أسماء، مرتّبة حسب أولويتك — الأول هو المفضّل لديك.
          </p>
          <div className="space-y-2">
            {names.map((name, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-muted-foreground w-5 text-sm">{index + 1}.</span>
                <Input
                  value={name}
                  onChange={(e) =>
                    setNames((prev) => prev.map((n, i) => (i === index ? e.target.value : n)))
                  }
                  placeholder="الاسم التجاري المقترح"
                  maxLength={120}
                />
                {names.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNames((prev) => prev.filter((_, i) => i !== index))}
                  >
                    حذف
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {names.length < MAX_TRADE_NAMES && (
              <Button type="button" variant="outline" size="sm" onClick={() => setNames((prev) => [...prev, ""])}>
                إضافة اسم آخر
              </Button>
            )}
            <Button type="submit" size="sm" disabled={submitting || filled.length === 0}>
              {submitting ? "جارٍ الإرسال..." : `تقديم ${filled.length || ""} اسم`}
            </Button>
          </div>
          {done && <p className="text-xs text-green-700">تم تقديم الأسماء وإشعار فريقنا.</p>}
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
