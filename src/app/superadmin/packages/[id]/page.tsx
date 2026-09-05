import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PackageForm } from "@/components/superadmin/package-form";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };

export default async function EditPackagePage({ params }: Params) {
  await requirePageRole([UserRole.super_admin]);

  const { id } = await params;
  const pkg = await prisma.package.findUnique({
    where: { id },
    include: { packageStages: true },
  });
  if (!pkg) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">تعديل باقة: {pkg.nameAr}</h1>
      <PackageForm
        mode="edit"
        packageId={pkg.id}
        initial={{
          code: pkg.code,
          nameAr: pkg.nameAr,
          trackId: pkg.trackId,
          description: pkg.description ?? "",
          totalPriceOverride: pkg.totalPriceOverride ? Number(pkg.totalPriceOverride) : null,
          discountType: pkg.discountType,
          discountValue: pkg.discountValue ? Number(pkg.discountValue) : null,
          isActive: pkg.isActive,
          stageIds: pkg.packageStages.map((ps) => ps.stageId),
        }}
      />
    </div>
  );
}
