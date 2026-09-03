"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export type StageFormValues = {
  code: string;
  trackScope: "regular_only" | "entrepreneurship_only" | "shared";
  nameAr: string;
  description: string;
  sequenceOrder: number;
  primaryActor: "client" | "team" | "system";
  requiresClientPresence: boolean;
  status: "active" | "deferred" | "tbd";
};

const DEFAULTS: StageFormValues = {
  code: "",
  trackScope: "shared",
  nameAr: "",
  description: "",
  sequenceOrder: 0,
  primaryActor: "team",
  requiresClientPresence: false,
  status: "active",
};

const selectClass =
  "border-input flex h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function StageForm({
  mode,
  stageId,
  initial,
}: {
  mode: "create" | "edit";
  stageId?: string;
  initial?: Partial<StageFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<StageFormValues>({ ...DEFAULTS, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof StageFormValues>(key: K, value: StageFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/superadmin/stages" : `/api/superadmin/stages/${stageId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّرت العملية.");
        return;
      }
      router.push("/superadmin/stages");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!stageId || !confirm("حذف هذه المرحلة نهائيًا؟")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/stages/${stageId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الحذف.");
        return;
      }
      router.push("/superadmin/stages");
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
          <Label htmlFor="sequenceOrder">الترتيب</Label>
          <Input
            id="sequenceOrder"
            type="number"
            value={values.sequenceOrder}
            onChange={(e) => set("sequenceOrder", Number(e.target.value))}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nameAr">الاسم</Label>
        <Input id="nameAr" value={values.nameAr} onChange={(e) => set("nameAr", e.target.value)} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">الوصف</Label>
        <Textarea
          id="description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="trackScope">نطاق المسار</Label>
          <select
            id="trackScope"
            className={selectClass}
            value={values.trackScope}
            onChange={(e) => set("trackScope", e.target.value as StageFormValues["trackScope"])}
          >
            <option value="regular_only">المسار النظامي فقط</option>
            <option value="entrepreneurship_only">مسار ريادة الأعمال فقط</option>
            <option value="shared">مشترك</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="primaryActor">الجهة المسؤولة</Label>
          <select
            id="primaryActor"
            className={selectClass}
            value={values.primaryActor}
            onChange={(e) => set("primaryActor", e.target.value as StageFormValues["primaryActor"])}
          >
            <option value="client">العميل</option>
            <option value="team">الفريق</option>
            <option value="system">النظام</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status">الحالة</Label>
        <select
          id="status"
          className={selectClass}
          value={values.status}
          onChange={(e) => set("status", e.target.value as StageFormValues["status"])}
        >
          <option value="active">نشطة</option>
          <option value="deferred">مؤجّلة</option>
          <option value="tbd">قيد التحديد</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="requiresClientPresence"
          checked={values.requiresClientPresence}
          onCheckedChange={(checked) => set("requiresClientPresence", checked)}
        />
        <Label htmlFor="requiresClientPresence">تتطلب حضور العميل شخصيًا</Label>
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
