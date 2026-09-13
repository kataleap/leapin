"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NATIONALITIES, nationalityLabel } from "@/lib/reference/nationalities";

// Manages the exceptions only: a nationality listed here cannot use this
// country. Anything absent is eligible — see the API route for why the set is
// stored that way round.
export function CountryNationalityRestrictions({
  countryId,
  initialIneligible,
}: {
  countryId: string;
  initialIneligible: string[];
}) {
  const [codes, setCodes] = useState<string[]>(initialIneligible);
  const [toAdd, setToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selectable = NATIONALITIES.filter((n) => !codes.includes(n.code));

  async function save(next: string[]) {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/countries/${countryId}/nationality-restrictions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ineligibleNationalityCodes: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "تعذّر حفظ القيود.");
        return;
      }
      setCodes(next);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-medium">قيود الجنسيات</h2>
        <p className="text-muted-foreground text-xs">
          الجنسيات المدرجة هنا لن تُعرض لها هذه الدولة في رحلة العميل. الدولة متاحة لكل جنسية غير
          مدرجة.
        </p>
      </div>

      {codes.length === 0 ? (
        <p className="text-muted-foreground text-sm">لا توجد قيود — الدولة متاحة لجميع الجنسيات.</p>
      ) : (
        <ul className="space-y-1">
          {codes.map((code) => (
            <li key={code} className="flex items-center justify-between text-sm">
              <span>{nationalityLabel(code)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => save(codes.filter((c) => c !== code))}
              >
                رفع القيد
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <select
          value={toAdd}
          onChange={(e) => setToAdd(e.target.value)}
          className="border-input h-8 flex-1 rounded-lg border bg-transparent px-2.5 text-sm"
        >
          <option value="">اختر جنسية لتقييدها…</option>
          {selectable.map((n) => (
            <option key={n.code} value={n.code}>
              {n.nameAr}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!toAdd || saving}
          onClick={() => {
            save([...codes, toAdd]);
            setToAdd("");
          }}
        >
          إضافة قيد
        </Button>
      </div>

      {saved && <p className="text-xs text-green-700">تم الحفظ.</p>}
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
