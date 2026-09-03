"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type OrderStage = {
  id: string;
  stageId: string;
  status: string;
  assignedAdminId: string | null;
  stage: { nameAr: string; code: string };
};
type DocumentItem = { id: string; documentType: string; fileUrl: string; isVisibleToClient: boolean };
type TradeName = { id: string; nameAr: string; batchNumber: number; priorityRank: number; status: string };

const STAGE_STATUS_OPTIONS = [
  "not_started",
  "in_progress",
  "waiting_on_client",
  "waiting_on_government",
  "blocked",
  "completed",
];

const selectClass =
  "border-input flex h-8 w-fit rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AdminOrderPanel({
  orderId,
  isSuperAdmin,
  currentUserId,
  initialStages,
  initialDocuments,
  initialTradeNames,
}: {
  orderId: string;
  isSuperAdmin: boolean;
  currentUserId: string;
  initialStages: OrderStage[];
  initialDocuments: DocumentItem[];
  initialTradeNames: TradeName[];
}) {
  const router = useRouter();
  const [stages, setStages] = useState(initialStages);
  const [documents, setDocuments] = useState(initialDocuments);
  const [tradeNames, setTradeNames] = useState(initialTradeNames);
  const [error, setError] = useState<string | null>(null);

  async function updateStage(stageEntry: OrderStage, patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/orders/${orderId}/stages/${stageEntry.stageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "تعذّر التحديث.");
      return;
    }
    setStages((prev) => prev.map((s) => (s.id === stageEntry.id ? { ...s, ...data.orderStage } : s)));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>المراحل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stages.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span>{s.stage.nameAr}</span>
                {s.status !== "skipped" &&
                  (s.assignedAdminId ? (
                    <Badge variant="secondary">مُسندة</Badge>
                  ) : (
                    <Badge variant="outline">غير مُسندة</Badge>
                  ))}
              </div>
              {s.status === "skipped" ? (
                <Badge variant="outline">غير مشمولة بهذا الطلب</Badge>
              ) : (
                <div className="flex items-center gap-2">
                  {isSuperAdmin && !s.assignedAdminId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => updateStage(s, { assignedAdminId: currentUserId })}
                    >
                      تعيين لي
                    </Button>
                  )}
                  <select
                    className={selectClass}
                    value={s.status}
                    disabled={!isSuperAdmin && s.assignedAdminId !== currentUserId}
                    onChange={(e) => updateStage(s, { status: e.target.value })}
                  >
                    {STAGE_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <DocumentUploadCard orderId={orderId} documents={documents} onUploaded={(d) => setDocuments((p) => [...p, d])} />
      <TradeNamesCard
        orderId={orderId}
        tradeNames={tradeNames}
        onBatchSubmitted={(names) => setTradeNames((p) => [...p, ...names])}
        onStatusUpdated={(id, status) =>
          setTradeNames((p) => p.map((t) => (t.id === id ? { ...t, status } : t)))
        }
      />
      <OtpRequestCard orderId={orderId} />
    </div>
  );
}

function DocumentUploadCard({
  orderId,
  documents,
  onUploaded,
}: {
  orderId: string;
  documents: DocumentItem[];
  onUploaded: (doc: DocumentItem) => void;
}) {
  const [documentType, setDocumentType] = useState("other");
  const [fileUrl, setFileUrl] = useState("");
  const [isVisibleToClient, setIsVisibleToClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType, fileUrl, isVisibleToClient }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الرفع.");
        return;
      }
      onUploaded(data.document);
      setFileUrl("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>المستندات</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.length > 0 && (
          <ul className="space-y-1 text-sm">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  {d.documentType}
                </a>
                <Badge variant={d.isVisibleToClient ? "default" : "outline"}>
                  {d.isVisibleToClient ? "ظاهر للعميل" : "مخفي"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>النوع</Label>
            <select className={selectClass} value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              <option value="misa_license">ترخيص وزارة الاستثمار</option>
              <option value="commercial_register">السجل التجاري</option>
              <option value="incorporation_contract">عقد التأسيس</option>
              <option value="foreign_company_docs">مستندات الشركة الأجنبية</option>
              <option value="financial_statements">القوائم المالية</option>
              <option value="other">أخرى</option>
            </select>
          </div>
          <div className="min-w-64 space-y-1.5">
            <Label>رابط الملف</Label>
            <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isVisibleToClient}
              onChange={(e) => setIsVisibleToClient(e.target.checked)}
            />
            ظاهر للعميل
          </label>
          <Button type="submit" disabled={submitting}>
            رفع
          </Button>
        </form>
        {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}

function TradeNamesCard({
  orderId,
  tradeNames,
  onBatchSubmitted,
  onStatusUpdated,
}: {
  orderId: string;
  tradeNames: TradeName[];
  onBatchSubmitted: (names: TradeName[]) => void;
  onStatusUpdated: (id: string, status: string) => void;
}) {
  const [names, setNames] = useState(["", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/trade-names/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الإرسال.");
        return;
      }
      onBatchSubmitted(data.tradeNames);
      setNames(["", "", "", "", ""]);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setError(null);
    const res = await fetch(`/api/admin/trade-names/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "تعذّر التحديث.");
      return;
    }
    onStatusUpdated(id, data.tradeName.status);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>الأسماء التجارية</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tradeNames.length > 0 && (
          <ul className="space-y-1 text-sm">
            {tradeNames.map((t) => (
              <li key={t.id} className="flex items-center justify-between">
                <span>
                  دفعة {t.batchNumber} — {t.nameAr}
                </span>
                <select className={selectClass} value={t.status} onChange={(e) => updateStatus(t.id, e.target.value)}>
                  <option value="submitted">مُرسل</option>
                  <option value="under_review">قيد المراجعة</option>
                  <option value="approved">مقبول</option>
                  <option value="rejected">مرفوض</option>
                </select>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleSubmit} className="space-y-2">
          <Label>دفعة جديدة (5 أسماء)</Label>
          <div className="grid grid-cols-2 gap-2">
            {names.map((n, idx) => (
              <Input
                key={idx}
                value={n}
                placeholder={`اسم ${idx + 1}`}
                onChange={(e) => setNames((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                required
              />
            ))}
          </div>
          <Button type="submit" disabled={submitting}>
            إرسال الدفعة
          </Button>
        </form>
        {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}

function OtpRequestCard({ orderId }: { orderId: string }) {
  const [governmentPlatform, setGovernmentPlatform] = useState("zatca");
  const [metaTemplateName, setMetaTemplateName] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/otp-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ governmentPlatform, metaTemplateName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الإرسال.");
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>طلب رمز تحقق (OTP)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>الجهة الحكومية</Label>
            <select
              className={selectClass}
              value={governmentPlatform}
              onChange={(e) => setGovernmentPlatform(e.target.value)}
            >
              <option value="zatca">هيئة الزكاة والضريبة</option>
              <option value="gosi">التأمينات الاجتماعية</option>
              <option value="absher_nafath">أبشر/نفاذ</option>
              <option value="other">أخرى</option>
            </select>
          </div>
          <div className="min-w-56 space-y-1.5">
            <Label>اسم القالب</Label>
            <Input value={metaTemplateName} onChange={(e) => setMetaTemplateName(e.target.value)} required />
          </div>
          <Button type="submit" disabled={submitting}>
            إرسال
          </Button>
        </form>
        {sent && <p className="mt-2 text-sm text-green-600">تم تسجيل الطلب.</p>}
        {error && <p className="text-destructive mt-2 text-sm" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}
