import { CountryForm } from "@/components/superadmin/country-form";

export default function NewCountryPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">إضافة دولة</h1>
      <CountryForm mode="create" />
    </div>
  );
}
