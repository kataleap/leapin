import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StageForm } from "@/components/superadmin/stage-form";
import { StagePricingManager } from "@/components/superadmin/stage-pricing-manager";
import { Separator } from "@/components/ui/separator";

type Params = { params: Promise<{ id: string }> };

export default async function EditStagePage({ params }: Params) {
  const { id } = await params;
  const stage = await prisma.stage.findUnique({
    where: { id },
    include: { stagePricing: true },
  });
  if (!stage) notFound();

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-xl font-semibold">تعديل مرحلة: {stage.nameAr}</h1>
      </div>
      <StageForm
        mode="edit"
        stageId={stage.id}
        initial={{
          code: stage.code,
          trackScope: stage.trackScope,
          nameAr: stage.nameAr,
          description: stage.description ?? "",
          sequenceOrder: stage.sequenceOrder,
          primaryActor: stage.primaryActor,
          requiresClientPresence: stage.requiresClientPresence,
          status: stage.status,
        }}
      />
      <Separator />
      <div className="space-y-3">
        <h2 className="text-sm font-medium">تسعير المرحلة</h2>
        <StagePricingManager
          stageId={stage.id}
          initial={stage.stagePricing.map((p) => ({
            id: p.id,
            pricingType: p.pricingType,
            basePrice: p.basePrice ? p.basePrice.toString() : null,
            currency: p.currency,
          }))}
        />
      </div>
    </div>
  );
}
