import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ActivityForm } from "@/components/superadmin/activity-form";

type Params = { params: Promise<{ id: string }> };

export default async function EditActivityPage({ params }: Params) {
  const { id } = await params;
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">تعديل نشاط: {activity.nameAr}</h1>
      <ActivityForm
        mode="edit"
        activityId={activity.id}
        initial={{
          categoryId: activity.categoryId,
          misaActivityCode: activity.misaActivityCode,
          nameAr: activity.nameAr,
          nameEn: activity.nameEn,
          isActive: activity.isActive,
        }}
      />
    </div>
  );
}
