"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Category = { id: string; nameAr: string; code: string };

export type ActivityFormValues = {
  categoryId: string;
  misaActivityCode: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
};

const DEFAULTS: ActivityFormValues = {
  categoryId: "",
  misaActivityCode: "",
  nameAr: "",
  nameEn: "",
  isActive: true,
};

const selectClass =
  "border-input flex h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ActivityForm({
  mode,
  activityId,
  initial,
}: {
  mode: "create" | "edit";
  activityId?: string;
  initial?: Partial<ActivityFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ActivityFormValues>({ ...DEFAULTS, ...initial });
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/superadmin/activity-categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  function set<K extends keyof ActivityFormValues>(key: K, value: ActivityFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/superadmin/activities" : `/api/superadmin/activities/${activityId}`;
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
      router.push("/superadmin/activities");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!activityId || !confirm("حذف هذا النشاط نهائيًا؟")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/activities/${activityId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الحذف.");
        return;
      }
      router.push("/superadmin/activities");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="categoryId">الفئة</Label>
        <select
          id="categoryId"
          className={selectClass}
          value={values.categoryId}
          onChange={(e) => set("categoryId", e.target.value)}
          required
        >
          <option value="">— اختر فئة —</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr} ({c.code})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="misaActivityCode">كود النشاط (ميسا)</Label>
        <Input
          id="misaActivityCode"
          value={values.misaActivityCode}
          onChange={(e) => set("misaActivityCode", e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="nameAr">الاسم بالعربية</Label>
          <Input id="nameAr" value={values.nameAr} onChange={(e) => set("nameAr", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nameEn">الاسم بالإنجليزية</Label>
          <Input id="nameEn" value={values.nameEn} onChange={(e) => set("nameEn", e.target.value)} required />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="isActive" checked={values.isActive} onCheckedChange={(checked) => set("isActive", checked)} />
        <Label htmlFor="isActive">نشط</Label>
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
