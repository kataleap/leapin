"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type UserFormValues = {
  name: string;
  email: string;
  role: "client" | "admin" | "super_admin";
  isActive: boolean;
};

const DEFAULTS: UserFormValues = { name: "", email: "", role: "admin", isActive: true };

const selectClass =
  "border-input flex h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function UserForm({
  mode,
  userId,
  isSelf,
  initial,
}: {
  mode: "create" | "edit";
  userId?: string;
  isSelf?: boolean;
  initial?: Partial<UserFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<UserFormValues>({ ...DEFAULTS, ...initial });
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/superadmin/users" : `/api/superadmin/users/${userId}`;
      const body =
        mode === "create"
          ? { ...values, phone, password }
          : { name: values.name, role: values.role, isActive: values.isActive, ...(password ? { password } : {}) };
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّرت العملية.");
        return;
      }
      router.push("/superadmin/users");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!userId || !confirm("حذف هذا المستخدم نهائيًا؟")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/users/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر الحذف.");
        return;
      }
      router.push("/superadmin/users");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">الاسم</Label>
        <Input id="name" value={values.name} onChange={(e) => set("name", e.target.value)} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input
          id="email"
          type="email"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          disabled={mode === "edit"}
          required
        />
      </div>

      {mode === "create" && (
        <div className="space-y-1.5">
          <Label htmlFor="phone">رقم الهاتف</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="password">
          {mode === "create" ? "كلمة المرور" : "كلمة مرور جديدة (اتركها فارغة لعدم التغيير)"}
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required={mode === "create"}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="role">الدور</Label>
        <select
          id="role"
          className={selectClass}
          value={values.role}
          disabled={isSelf}
          onChange={(e) => set("role", e.target.value as UserFormValues["role"])}
        >
          <option value="client">عميل</option>
          <option value="admin">أدمن</option>
          <option value="super_admin">سوبر أدمن</option>
        </select>
        {isSelf && <p className="text-muted-foreground text-xs">لا يمكنك تغيير دور حسابك الخاص.</p>}
      </div>

      {mode === "edit" && (
        <div className="flex items-center gap-2">
          <Switch
            id="isActive"
            checked={values.isActive}
            disabled={isSelf}
            onCheckedChange={(checked) => set("isActive", checked)}
          />
          <Label htmlFor="isActive">حساب نشط</Label>
          {isSelf && <p className="text-muted-foreground text-xs">لا يمكنك تعطيل حسابك الخاص.</p>}
        </div>
      )}

      {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "جارٍ الحفظ..." : mode === "create" ? "إنشاء" : "حفظ التغييرات"}
        </Button>
        {mode === "edit" && !isSelf && (
          <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
            {deleting ? "جارٍ الحذف..." : "حذف"}
          </Button>
        )}
      </div>
    </form>
  );
}
