"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Pkg = { id: string; nameAr: string };

type Installment = {
  percentage: number;
  triggerType: "on_registration" | "on_stage_complete" | "fixed_date" | "manual";
};

export type PaymentPlanFormValues = {
  ownerType: "package" | "order";
  ownerId: string;
  code: string;
  isDefault: boolean;
  isClientSelectable: boolean;
  installments: Installment[];
};

const DEFAULTS: PaymentPlanFormValues = {
  ownerType: "package",
  ownerId: "",
  code: "",
  isDefault: false,
  isClientSelectable: true,
  installments: [
    { percentage: 50, triggerType: "on_registration" },
    { percentage: 50, triggerType: "on_stage_complete" },
  ],
};

const selectClass =
  "border-input flex h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const TRIGGER_LABEL: Record<Installment["triggerType"], string> = {
  on_registration: "عند التسجيل",
  on_stage_complete: "عند اكتمال مرحلة",
  fixed_date: "تاريخ محدد",
  manual: "يدوي",
};

export function PaymentPlanForm({
  mode,
  planId,
  initial,
}: {
  mode: "create" | "edit";
  planId?: string;
  initial?: Partial<PaymentPlanFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PaymentPlanFormValues>({ ...DEFAULTS, ...initial });
  const [packages, setPackages] = useState<Pkg[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/superadmin/packages")
      .then((r) => r.json())
      .then((d) => setPackages(d.packages ?? []));
  }, []);

  function set<K extends keyof PaymentPlanFormValues>(key: K, value: PaymentPlanFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setInstallment(index: number, patch: Partial<Installment>) {
    setValues((v) => ({
      ...v,
      installments: v.installments.map((i, idx) => (idx === index ? { ...i, ...patch } : i)),
    }));
  }

  function addInstallment() {
    if (values.installments.length >= 4) return;
    setValues((v) => ({ ...v, installments: [...v.installments, { percentage: 0, triggerType: "manual" }] }));
  }

  function removeInstallment(index: number) {
    if (values.installments.length <= 2) return;
    setValues((v) => ({ ...v, installments: v.installments.filter((_, idx) => idx !== index) }));
  }

  const percentageSum = values.installments.reduce((acc, i) => acc + (Number(i.percentage) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (Math.abs(percentageSum - 100) > 0.01) {
      setError("مجموع نسب الدفعات يجب أن يساوي 100%.");
      return;
    }
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/superadmin/payment-plans" : `/api/superadmin/payment-plans/${planId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerType: values.ownerType,
          ownerId: values.ownerId,
          code: values.code,
          isDefault: values.isDefault,
          isClientSelectable: values.isClientSelectable,
          installments: values.installments.map((i, idx) => ({
            installmentNumber: idx + 1,
            percentage: Number(i.percentage),
            triggerType: i.triggerType,
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّرت العملية.");
        return;
      }
      router.push("/superadmin/payment-plans");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!planId || !confirm("حذف هذه الخطة نهائيًا؟")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/payment-plans/${planId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الحذف.");
        return;
      }
      router.push("/superadmin/payment-plans");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">الرمز</Label>
          <Input id="code" value={values.code} onChange={(e) => set("code", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ownerType">النوع</Label>
          <select
            id="ownerType"
            className={selectClass}
            value={values.ownerType}
            onChange={(e) => set("ownerType", e.target.value as PaymentPlanFormValues["ownerType"])}
          >
            <option value="package">مرتبطة بباقة</option>
            <option value="order">مرتبطة بطلب محدد</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ownerId">{values.ownerType === "package" ? "الباقة" : "معرّف الطلب"}</Label>
        {values.ownerType === "package" ? (
          <select
            id="ownerId"
            className={selectClass}
            value={values.ownerId}
            onChange={(e) => set("ownerId", e.target.value)}
            required
          >
            <option value="">— اختر باقة —</option>
            {packages?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameAr}
              </option>
            ))}
          </select>
        ) : (
          <Input id="ownerId" value={values.ownerId} onChange={(e) => set("ownerId", e.target.value)} required />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>الدفعات (المجموع الحالي: {percentageSum}%)</Label>
          {values.installments.length < 4 && (
            <Button type="button" variant="ghost" size="sm" onClick={addInstallment}>
              + دفعة
            </Button>
          )}
        </div>
        {values.installments.map((installment, index) => (
          <div key={index} className="flex items-end gap-3 rounded-lg border p-3">
            <div className="w-24 space-y-1.5">
              <Label>النسبة (%)</Label>
              <Input
                type="number"
                value={installment.percentage}
                onChange={(e) => setInstallment(index, { percentage: Number(e.target.value) })}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>وقت الاستحقاق</Label>
              <select
                className={selectClass}
                value={installment.triggerType}
                onChange={(e) =>
                  setInstallment(index, { triggerType: e.target.value as Installment["triggerType"] })
                }
              >
                {Object.entries(TRIGGER_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {values.installments.length > 2 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => removeInstallment(index)}>
                حذف
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch id="isDefault" checked={values.isDefault} onCheckedChange={(c) => set("isDefault", c)} />
          <Label htmlFor="isDefault">خطة افتراضية</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="isClientSelectable"
            checked={values.isClientSelectable}
            onCheckedChange={(c) => set("isClientSelectable", c)}
          />
          <Label htmlFor="isClientSelectable">يمكن للعميل اختيارها</Label>
        </div>
      </div>

      {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "جارٍ الحفظ..." : mode === "create" ? "إنشاء" : "حفظ التغييرات"}
        </Button>
        {mode === "edit" && (
          <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
            {deleting ? "جارٍ الحذف..." : "حذف"}
          </Button>
        )}
      </div>
    </form>
  );
}
