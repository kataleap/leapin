"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Track = { id: string; nameAr: string };

export type ActivityCategoryFormValues = {
  trackId: string;
  code: string;
  nameAr: string;
  minForeignCompanies: number | null;
  minCapitalSar: number | null;
  allowedInEntrepreneurship: boolean;
  status: "active" | "tbd";
};

const DEFAULTS: ActivityCategoryFormValues = {
  trackId: "",
  code: "",
  nameAr: "",
  minForeignCompanies: null,
  minCapitalSar: null,
  allowedInEntrepreneurship: false,
  status: "active",
};

const selectClass =
  "border-input flex h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ActivityCategoryForm({
  mode,
  categoryId,
  initial,
}: {
  mode: "create" | "edit";
  categoryId?: string;
  initial?: Partial<ActivityCategoryFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ActivityCategoryFormValues>({ ...DEFAULTS, ...initial });
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/journey/tracks")
      .then((r) => r.json())
      .then((d) => setTracks(d.tracks ?? []));
  }, []);

  function set<K extends keyof ActivityCategoryFormValues>(key: K, value: ActivityCategoryFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const url =
        mode === "create" ? "/api/superadmin/activity-categories" : `/api/superadmin/activity-categories/${categoryId}`;
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
      router.push("/superadmin/activity-categories");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!categoryId || !confirm("حذف هذه الفئة نهائيًا؟")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/activity-categories/${categoryId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الحذف.");
        return;
      }
      router.push("/superadmin/activity-categories");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="trackId">المسار</Label>
        <select
          id="trackId"
          className={selectClass}
          value={values.trackId}
          onChange={(e) => set("trackId", e.target.value)}
          required
        >
          <option value="">— اختر مسارًا —</option>
          {tracks?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nameAr}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">الرمز</Label>
          <Input
            id="code"
            value={values.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="service / commercial"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nameAr">الاسم</Label>
          <Input id="nameAr" value={values.nameAr} onChange={(e) => set("nameAr", e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="minForeignCompanies">عدد الشركات الأجنبية المطلوبة</Label>
          <Input
            id="minForeignCompanies"
            type="number"
            value={values.minForeignCompanies ?? ""}
            onChange={(e) => set("minForeignCompanies", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minCapitalSar">الحد الأدنى لرأس المال (ريال)</Label>
          <Input
            id="minCapitalSar"
            type="number"
            value={values.minCapitalSar ?? ""}
            onChange={(e) => set("minCapitalSar", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status">الحالة</Label>
        <select
          id="status"
          className={selectClass}
          value={values.status}
          onChange={(e) => set("status", e.target.value as ActivityCategoryFormValues["status"])}
        >
          <option value="active">نشطة</option>
          <option value="tbd">محجوزة (TBD)</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="allowedInEntrepreneurship"
          checked={values.allowedInEntrepreneurship}
          onCheckedChange={(checked) => set("allowedInEntrepreneurship", checked)}
        />
        <Label htmlFor="allowedInEntrepreneurship">مسموحة ضمن مسار ريادة الأعمال</Label>
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
