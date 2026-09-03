"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type CountryFormValues = {
  nameAr: string;
  nameEn: string;
  basePrice: number;
  durationMinDays: number;
  durationMaxDays: number;
  poaRequired: boolean;
  status: "active" | "inactive";
};

const DEFAULTS: CountryFormValues = {
  nameAr: "",
  nameEn: "",
  basePrice: 0,
  durationMinDays: 0,
  durationMaxDays: 0,
  poaRequired: false,
  status: "active",
};

const selectClass =
  "border-input flex h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CountryForm({
  mode,
  countryId,
  initial,
}: {
  mode: "create" | "edit";
  countryId?: string;
  initial?: Partial<CountryFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CountryFormValues>({ ...DEFAULTS, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof CountryFormValues>(key: K, value: CountryFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/superadmin/countries" : `/api/superadmin/countries/${countryId}`;
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
      router.push("/superadmin/countries");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!countryId || !confirm("حذف هذه الدولة نهائيًا؟")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/countries/${countryId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الحذف.");
        return;
      }
      router.push("/superadmin/countries");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="space-y-1.5">
        <Label htmlFor="basePrice">السعر (ريال)</Label>
        <Input
          id="basePrice"
          type="number"
          value={values.basePrice}
          onChange={(e) => set("basePrice", Number(e.target.value))}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="durationMinDays">أقل مدة (أيام)</Label>
          <Input
            id="durationMinDays"
            type="number"
            value={values.durationMinDays}
            onChange={(e) => set("durationMinDays", Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="durationMaxDays">أقصى مدة (أيام)</Label>
          <Input
            id="durationMaxDays"
            type="number"
            value={values.durationMaxDays}
            onChange={(e) => set("durationMaxDays", Number(e.target.value))}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status">الحالة</Label>
        <select
          id="status"
          className={selectClass}
          value={values.status}
          onChange={(e) => set("status", e.target.value as CountryFormValues["status"])}
        >
          <option value="active">نشطة</option>
          <option value="inactive">غير نشطة</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="poaRequired"
          checked={values.poaRequired}
          onCheckedChange={(checked) => set("poaRequired", checked)}
        />
        <Label htmlFor="poaRequired">تتطلب توكيل رسمي (POA)</Label>
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
