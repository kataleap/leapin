import { z } from "zod";
import { PaymentPlanOwnerType, InstallmentTriggerType } from "@/generated/prisma/enums";

const installmentInputSchema = z.object({
  installmentNumber: z.number().int().positive(),
  percentage: z.number().positive().max(100),
  triggerType: z.enum(InstallmentTriggerType),
  triggerStageId: z.uuid().nullable().optional(),
  fixedDueDate: z.iso.date().nullable().optional(),
});

function refineInstallments<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (data) => {
      const d = data as { installments?: z.infer<typeof installmentInputSchema>[] };
      if (!d.installments) return true;
      const sum = d.installments.reduce((acc, i) => acc + i.percentage, 0);
      return Math.abs(sum - 100) < 0.01;
    },
    { message: "Installment percentages must sum to 100", path: ["installments"] }
  );
}

// Phase 3: an on_stage_complete installment is meaningless without knowing
// which stage activates it.
function refineTriggerStage<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (data) => {
      const d = data as { installments?: z.infer<typeof installmentInputSchema>[] };
      if (!d.installments) return true;
      return d.installments.every((i) => i.triggerType !== "on_stage_complete" || !!i.triggerStageId);
    },
    { message: "triggerStageId is required when triggerType is on_stage_complete", path: ["installments"] }
  );
}

// See src/lib/validation/stages.ts for why create/update must not share a
// schema with `.default()` fields — isDefault/isClientSelectable get
// defaults ONLY on the create schema below.
const shape = {
  ownerType: z.enum(PaymentPlanOwnerType),
  ownerId: z.uuid(),
  code: z.string().min(1).max(64),
  isDefault: z.boolean().optional(),
  isClientSelectable: z.boolean().optional(),
  // Fully replaces the plan's installments on both create and update.
  installments: z.array(installmentInputSchema).min(2).max(4),
};

export const paymentPlanCreateSchema = refineTriggerStage(
  refineInstallments(
    z.object(shape).extend({
      isDefault: z.boolean().default(false),
      isClientSelectable: z.boolean().default(true),
    })
  )
);

export const paymentPlanUpdateSchema = refineTriggerStage(
  refineInstallments(z.object({ ...shape, installments: shape.installments.optional() }).partial())
);
