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
type DocumentItem = {
  id: string;
  documentType: string;
  originalFileName: string;
  isVisibleToClient: boolean;
};
type TradeName = { id: string; nameAr: string; batchNumber: number; priorityRank: number; status: string };
type OrderPaymentItem = {
  id: string;
  installmentNumber: number;
  amount: number;
  status: string;
  method: string | null;
  dueAt: Date | null;
  gatewayReference: string | null;
  proofOriginalFileName: string | null;
};
type NotificationLogItem = {
  id: string;
  channel: string;
  eventType: string;
  status: string;
  errorMessage: string | null;
  sentAt: Date;
};

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
  initialOrderPayments,
  initialNotificationLogs,
}: {
  orderId: string;
  isSuperAdmin: boolean;
  currentUserId: string;
  initialStages: OrderStage[];
  initialDocuments: DocumentItem[];
  initialTradeNames: TradeName[];
  initialOrderPayments: OrderPaymentItem[];
  initialNotificationLogs: NotificationLogItem[];
}) {
  const router = useRouter();
  const [stages, setStages] = useState(initialStages);
  const [documents, setDocuments] = useState(initialDocuments);
  const [tradeNames, setTradeNames] = useState(initialTradeNames);
  const [orderPayments, setOrderPayments] = useState(initialOrderPayments);
  const [notificationLogs, setNotificationLogs] = useState(initialNotificationLogs);
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

      <PaymentsCard
        orderId={orderId}
        payments={orderPayments}
        onUpdated={(p) => setOrderPayments((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
      />
      <NotificationsCard
        logs={notificationLogs}
        onUpdated={(log) => setNotificationLogs((prev) => prev.map((x) => (x.id === log.id ? log : x)))}
      />
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

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  online: "الكتروني",
  bank_transfer: "تحويل بنكي",
  cash: "كاش",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "مستحقة",
  paid: "مدفوعة",
  failed: "فشلت",
  refunded: "مُستردة",
};

function PaymentsCard({
  orderId,
  payments,
  onUpdated,
}: {
  orderId: string;
  payments: OrderPaymentItem[];
  onUpdated: (payment: OrderPaymentItem) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function runAction(
    payment: OrderPaymentItem,
    method: "POST" | "PUT",
    url: string,
    body?: Record<string, unknown>
  ) {
    setError(null);
    setBusyId(payment.id);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّرت العملية.");
        return;
      }
      if (data?.orderPayment) onUpdated(data.orderPayment);
    } finally {
      setBusyId(null);
    }
  }

  if (payments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>المدفوعات</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {payments.map((p) => (
          <div key={p.id} className="space-y-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>
                الدفعة {p.installmentNumber} — {p.amount.toLocaleString("ar-SA")} ريال
              </span>
              <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "outline"}>
                {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
              </Badge>
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {p.method && <span>الطريقة: {PAYMENT_METHOD_LABEL[p.method] ?? p.method}</span>}
              {p.dueAt && <span>مستحقة منذ: {new Date(p.dueAt).toLocaleDateString("ar-SA")}</span>}
              {p.gatewayReference && <span>مرجع البوابة: {p.gatewayReference}</span>}
              {p.proofOriginalFileName && (
                <a
                  href={`/api/orders/${orderId}/payments/${p.installmentNumber}/proof`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  عرض الإيصال
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {p.dueAt && p.status === "pending" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === p.id}
                  onClick={() => runAction(p, "POST", `/api/orders/${orderId}/payments/${p.installmentNumber}/checkout`)}
                >
                  إعادة إرسال رابط الدفع
                </Button>
              )}
              {p.method === "bank_transfer" && p.proofOriginalFileName && p.status === "pending" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === p.id}
                  onClick={() => runAction(p, "POST", `/api/admin/payments/${p.id}/confirm`, { method: "bank_transfer" })}
                >
                  تأكيد استلام التحويل
                </Button>
              )}
              {p.dueAt && p.status === "pending" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === p.id}
                  onClick={() => runAction(p, "POST", `/api/admin/payments/${p.id}/confirm`, { method: "cash" })}
                >
                  تسجيل دفعة كاش
                </Button>
              )}
              {p.method === "online" && p.gatewayReference && p.status === "pending" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === p.id}
                  onClick={() => runAction(p, "POST", `/api/admin/payments/${p.id}/sync`)}
                >
                  مزامنة الحالة
                </Button>
              )}
              {p.status === "paid" && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busyId === p.id}
                  onClick={() => {
                    if (confirm("تسجيل استرجاع لهذه الدفعة؟")) {
                      runAction(p, "PUT", `/api/admin/payments/${p.id}`, { status: "refunded" });
                    }
                  }}
                >
                  تسجيل استرجاع
                </Button>
              )}
            </div>
          </div>
        ))}
        {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}

const NOTIFICATION_EVENT_LABEL: Record<string, string> = {
  stage_completed: "اكتمال مرحلة",
  waiting_on_client: "بانتظار إجراء العميل",
  payment_due: "استحقاق دفعة",
};

const NOTIFICATION_STATUS_LABEL: Record<string, string> = {
  sent: "أُرسلت",
  failed: "فشلت",
  bounced: "مرتدة",
};

function NotificationsCard({
  logs,
  onUpdated,
}: {
  logs: NotificationLogItem[];
  onUpdated: (log: NotificationLogItem) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function resend(log: NotificationLogItem) {
    setError(null);
    setBusyId(log.id);
    try {
      const res = await fetch(`/api/admin/notifications/${log.id}/resend`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّرت إعادة الإرسال.");
        return;
      }
      if (data?.notificationLog) onUpdated(data.notificationLog);
    } finally {
      setBusyId(null);
    }
  }

  if (logs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>سجل الإشعارات الخارجية</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <div className="flex flex-col gap-1">
              <span>{NOTIFICATION_EVENT_LABEL[log.eventType] ?? log.eventType} — بريد إلكتروني</span>
              <span className="text-muted-foreground text-xs">
                {new Date(log.sentAt).toLocaleString("ar-SA")}
                {log.errorMessage ? ` — ${log.errorMessage}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                {NOTIFICATION_STATUS_LABEL[log.status] ?? log.status}
              </Badge>
              {log.status === "failed" && (
                <Button type="button" size="sm" variant="outline" disabled={busyId === log.id} onClick={() => resend(log)}>
                  إعادة إرسال
                </Button>
              )}
            </div>
          </div>
        ))}
        {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
      </CardContent>
    </Card>
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
  const [file, setFile] = useState<File | null>(null);
  const [isVisibleToClient, setIsVisibleToClient] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("اختر ملفًا للرفع.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("documentType", documentType);
      formData.set("isVisibleToClient", String(isVisibleToClient));
      const res = await fetch(`/api/admin/orders/${orderId}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الرفع.");
        return;
      }
      onUploaded(data.document);
      setFile(null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
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
                <a
                  href={`/api/documents/${d.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {d.originalFileName}
                </a>
                <Badge variant={d.isVisibleToClient ? "default" : "outline"}>
                  {d.isVisibleToClient ? "ظاهر للعميل" : "مخفي"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isVisibleToClient}
                onChange={(e) => setIsVisibleToClient(e.target.checked)}
              />
              ظاهر للعميل
            </label>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm ${
              dragging ? "border-primary bg-muted" : "border-input"
            }`}
          >
            <p className="text-muted-foreground">اسحب الملف هنا أو اختره من جهازك</p>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="text-sm font-medium">{file.name}</p>}
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? "جارٍ الرفع..." : "رفع"}
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
  const [names, setNames] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addName() {
    setNames((prev) => (prev.length < 10 ? [...prev, ""] : prev));
  }

  function removeName(idx: number) {
    setNames((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = names.map((n) => n.trim()).filter(Boolean);
    if (trimmed.length === 0) {
      setError("أدخل اسمًا واحدًا على الأقل.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/trade-names/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الإرسال.");
        return;
      }
      onBatchSubmitted(data.tradeNames);
      setNames([""]);
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
          <Label>دفعة جديدة (١–١٠ أسماء)</Label>
          <div className="space-y-2">
            {names.map((n, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={n}
                  placeholder={`اسم ${idx + 1}`}
                  onChange={(e) => setNames((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                />
                {names.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeName(idx)}>
                    إزالة
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" disabled={names.length >= 10} onClick={addName}>
              + إضافة اسم
            </Button>
            <Button type="submit" disabled={submitting}>
              إرسال الدفعة
            </Button>
          </div>
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
