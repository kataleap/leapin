"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Category = { id: string; nameAr: string; code: string };

const selectClass =
  "border-input flex h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ActivityMixingRuleForm() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [baseCategoryId, setBaseCategoryId] = useState("");
  const [addableCategoryId, setAddableCategoryId] = useState("");
  const [isAllowed, setIsAllowed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/superadmin/activity-categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (baseCategoryId === addableCategoryId) {
      setError("الفئة الأساسية والفئة المضافة يجب أن تكونا مختلفتين.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/superadmin/activity-mixing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCategoryId, addableCategoryId, isAllowed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّرت العملية.");
        return;
      }
      router.push("/superadmin/activity-mixing-rules");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="baseCategoryId">الفئة الأساسية</Label>
        <select
          id="baseCategoryId"
          className={selectClass}
          value={baseCategoryId}
          onChange={(e) => setBaseCategoryId(e.target.value)}
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
        <Label htmlFor="addableCategoryId">الفئة المطلوب إضافتها</Label>
        <select
          id="addableCategoryId"
          className={selectClass}
          value={addableCategoryId}
          onChange={(e) => setAddableCategoryId(e.target.value)}
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

      <div className="flex items-center gap-2">
        <Switch id="isAllowed" checked={isAllowed} onCheckedChange={setIsAllowed} />
        <Label htmlFor="isAllowed">مسموح بالدمج</Label>
      </div>

      {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "جارٍ الحفظ..." : "إنشاء"}
      </Button>
    </form>
  );
}
