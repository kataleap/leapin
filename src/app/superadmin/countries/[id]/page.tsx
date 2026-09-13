import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CountryForm } from "@/components/superadmin/country-form";
import { CountryNationalityRestrictions } from "@/components/superadmin/country-nationality-restrictions";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };

export default async function EditCountryPage({ params }: Params) {
  await requirePageRole([UserRole.super_admin]);

  const { id } = await params;
  const country = await prisma.country.findUnique({
    where: { id },
    include: { nationalityRestrictions: true },
  });
  if (!country) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">تعديل دولة: {country.nameAr}</h1>
      <CountryForm
        mode="edit"
        countryId={country.id}
        initial={{
          nameAr: country.nameAr,
          nameEn: country.nameEn,
          basePrice: Number(country.basePrice),
          durationMinDays: country.durationMinDays,
          durationMaxDays: country.durationMaxDays,
          poaRequired: country.poaRequired,
          status: country.status,
        }}
      />
      <CountryNationalityRestrictions
        countryId={country.id}
        initialIneligible={country.nationalityRestrictions
          .filter((r) => !r.isEligible)
          .map((r) => r.nationalityCode)}
      />
    </div>
  );
}
