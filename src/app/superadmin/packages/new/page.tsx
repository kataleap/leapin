import { PackageForm } from "@/components/superadmin/package-form";

export default function NewPackagePage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة باقة</h1>
      <PackageForm mode="create" />
    </div>
  );
}
