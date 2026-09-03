"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeleteMixingRuleButton({ ruleId }: { ruleId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("حذف قاعدة الدمج هذه؟")) return;
    setDeleting(true);
    try {
      await fetch(`/api/superadmin/activity-mixing-rules/${ruleId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button type="button" variant="destructive" size="sm" disabled={deleting} onClick={handleDelete}>
      {deleting ? "جارٍ الحذف..." : "حذف"}
    </Button>
  );
}
