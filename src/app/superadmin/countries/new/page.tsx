import { CountryForm } from "@/components/superadmin/country-form";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function NewCountryPage() {
  await requirePageRole([UserRole.super_admin]);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة دولة</h1>
      <CountryForm mode="create" />
    </div>
  );
}
