"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type Track = { id: string; nameAr: string };
type Stage = { id: string; code: string; nameAr: string; sequenceOrder: number };

export type PackageFormValues = {
  code: string;
  nameAr: string;
  trackId: string | null;
  description: string;
  totalPriceOverride: number | null;
  discountType: "none" | "percentage" | "fixed_amount";
  discountValue: number | null;
  isActive: boolean;
  stageIds: string[];
};

const DEFAULTS: PackageFormValues = {
  code: "",
  nameAr: "",
  trackId: null,
  description: "",
  totalPriceOverride: null,
  discountType: "none",
  discountValue: null,
  isActive: true,
  stageIds: [],
};

const selectClass =
  "border-input flex h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PackageForm({
  mode,
  packageId,
  initial,
}: {
  mode: "create" | "edit";
  packageId?: string;
  initial?: Partial<PackageFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PackageFormValues>({ ...DEFAULTS, ...initial });
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/journey/tracks")
      .then((r) => r.json())
      .then((d) => setTracks(d.tracks ?? []));
    fetch("/api/superadmin/stages")
      .then((r) => r.json())
      .then((d) => setStages((d.stages ?? []).sort((a: Stage, b: Stage) => a.sequenceOrder - b.sequenceOrder)));
  }, []);

  function set<K extends keyof PackageFormValues>(key: K, value: PackageFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleStage(stageId: string) {
    setValues((v) => ({
      ...v,
      stageIds: v.stageIds.includes(stageId)
        ? v.stageIds.filter((id) => id !== stageId)
        : [...v.stageIds, stageId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (values.stageIds.length === 0) {
      setError("اختر مرحلة واحدة على الأقل.");
      return;
    }
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/superadmin/packages" : `/api/superadmin/packages/${packageId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: values.code,
          nameAr: values.nameAr,
          trackId: values.trackId,
          description: values.description || undefined,
          totalPriceOverride: values.totalPriceOverride,
          discountType: values.discountType,
          discountValue: values.discountValue,
          isActive: values.isActive,
          stages: values.stageIds.map((stageId) => ({ stageId })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّرت العملية.");
        return;
      }
      router.push("/superadmin/packages");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!packageId || !confirm("حذف هذه الباقة نهائيًا؟")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/packages/${packageId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الحذف.");
        return;
      }
      router.push("/superadmin/packages");
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
          <Label htmlFor="nameAr">الاسم</Label>
          <Input id="nameAr" value={values.nameAr} onChange={(e) => set("nameAr", e.target.value)} required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">الوصف</Label>
        <Textarea
          id="description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="trackId">المسار (اختياري — اتركه فارغًا لباقة مستقلة عن المسار)</Label>
        <select
          id="trackId"
          className={selectClass}
          value={values.trackId ?? ""}
          onChange={(e) => set("trackId", e.target.value || null)}
        >
          <option value="">— بلا مسار محدد —</option>
          {tracks?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nameAr}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>المراحل المشمولة</Label>
        {stages === null ? (
          <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
            {stages.map((stage) => (
              <label key={stage.id} className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  checked={values.stageIds.includes(stage.id)}
                  onChange={() => toggleStage(stage.id)}
                />
                <span>
                  {stage.code} — {stage.nameAr}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="discountType">نوع الخصم</Label>
          <select
            id="discountType"
            className={selectClass}
            value={values.discountType}
            onChange={(e) => set("discountType", e.target.value as PackageFormValues["discountType"])}
          >
            <option value="none">بدون خصم</option>
            <option value="percentage">نسبة مئوية</option>
            <option value="fixed_amount">مبلغ ثابت</option>
          </select>
        </div>
        {values.discountType !== "none" && (
          <div className="space-y-1.5">
            <Label htmlFor="discountValue">
              قيمة الخصم {values.discountType === "percentage" ? "(%)" : "(ريال)"}
            </Label>
            <Input
              id="discountValue"
              type="number"
              value={values.discountValue ?? ""}
              onChange={(e) => set("discountValue", e.target.value ? Number(e.target.value) : null)}
              required
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="totalPriceOverride">سعر إجمالي ثابت (اختياري — يتجاوز مجموع أسعار المراحل)</Label>
        <Input
          id="totalPriceOverride"
          type="number"
          value={values.totalPriceOverride ?? ""}
          onChange={(e) => set("totalPriceOverride", e.target.value ? Number(e.target.value) : null)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch id="isActive" checked={values.isActive} onCheckedChange={(checked) => set("isActive", checked)} />
        <Label htmlFor="isActive">نشطة</Label>
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
