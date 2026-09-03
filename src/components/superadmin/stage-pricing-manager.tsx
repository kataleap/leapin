"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type StagePricing = {
  id: string;
  pricingType: "fixed" | "variable_by_country" | "variable_by_category" | "bundled_only";
  basePrice: string | null;
  currency: string;
};

const PRICING_TYPE_LABEL: Record<StagePricing["pricingType"], string> = {
  fixed: "سعر ثابت",
  variable_by_country: "متغيّر حسب الدولة",
  variable_by_category: "متغيّر حسب الفئة",
  bundled_only: "ضمن مرحلة أخرى فقط",
};

const selectClass =
  "border-input flex h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function StagePricingManager({ stageId, initial }: { stageId: string; initial: StagePricing[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pricingType, setPricingType] = useState<StagePricing["pricingType"]>("fixed");
  const [basePrice, setBasePrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/superadmin/stage-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId,
          pricingType,
          basePrice: pricingType === "fixed" && basePrice ? Number(basePrice) : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّرت الإضافة.");
        return;
      }
      setItems((prev) => [...prev, data.stagePricing]);
      setBasePrice("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/superadmin/stage-pricing/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "تعذّر الحذف.");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">لا يوجد تسعير لهذه المرحلة بعد.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span className="flex items-center gap-2">
                <Badge variant="secondary">{PRICING_TYPE_LABEL[item.pricingType]}</Badge>
                {item.basePrice && (
                  <span>
                    {Number(item.basePrice).toLocaleString("ar-SA")} {item.currency}
                  </span>
                )}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                حذف
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pricingType">نوع التسعير</Label>
          <select
            id="pricingType"
            className={selectClass}
            value={pricingType}
            onChange={(e) => setPricingType(e.target.value as StagePricing["pricingType"])}
          >
            <option value="fixed">سعر ثابت</option>
            <option value="variable_by_country">متغيّر حسب الدولة</option>
            <option value="variable_by_category">متغيّر حسب الفئة</option>
            <option value="bundled_only">ضمن مرحلة أخرى فقط</option>
          </select>
        </div>
        {pricingType === "fixed" && (
          <div className="space-y-1.5">
            <Label htmlFor="basePrice">السعر (ريال)</Label>
            <Input
              id="basePrice"
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>
        )}
        <Button type="submit" disabled={submitting}>
          إضافة
        </Button>
      </form>
      {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
    </div>
  );
}
