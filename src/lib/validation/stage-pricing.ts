import { z } from "zod";
import { StagePricingType } from "@/generated/prisma/enums";

// See src/lib/validation/stages.ts for why create/update must not share a
// schema with `.default()` fields.
const shape = {
  stageId: z.uuid(),
  pricingType: z.enum(StagePricingType),
  basePrice: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
};

export const stagePricingCreateSchema = z.object(shape).extend({
  currency: z.string().length(3).default("SAR"),
});

export const stagePricingUpdateSchema = z.object(shape).partial();
