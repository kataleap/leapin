import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ActivityCategoryForm } from "@/components/superadmin/activity-category-form";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };

export default async function EditActivityCategoryPage({ params }: Params) {
  await requirePageRole([UserRole.super_admin]);

  const { id } = await params;
  const category = await prisma.activityCategory.findUnique({ where: { id } });
  if (!category) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">تعديل فئة: {category.nameAr}</h1>
      <ActivityCategoryForm
        mode="edit"
        categoryId={category.id}
        initial={{
          trackId: category.trackId,
          code: category.code,
          nameAr: category.nameAr,
          minForeignCompanies: category.minForeignCompanies,
          minCapitalSar: category.minCapitalSar ? Number(category.minCapitalSar) : null,
          allowedInEntrepreneurship: category.allowedInEntrepreneurship,
          status: category.status,
        }}
      />
    </div>
  );
}
