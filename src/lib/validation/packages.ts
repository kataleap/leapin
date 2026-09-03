import { z } from "zod";
import { DiscountType } from "@/generated/prisma/enums";

const packageStageInputSchema = z.object({
  stageId: z.uuid(),
  isOptionalAddon: z.boolean().optional().default(false),
});

// See src/lib/validation/stages.ts for why create/update must not share a
// schema with `.default()` fields — discountType/isActive get defaults ONLY
// on the create schema below.
const shape = {
  code: z.string().min(1).max(64),
  nameAr: z.string().min(1),
  trackId: z.uuid().nullable().optional(),
  description: z.string().optional(),
  totalPriceOverride: z.number().nonnegative().nullable().optional(),
  discountType: z.enum(DiscountType).optional(),
  discountValue: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
  // When provided, fully replaces the package's stage links (create: sets
  // them; update: deletes existing links and re-creates from this list).
  stages: z.array(packageStageInputSchema).min(1).optional(),
};

function refineDiscount<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (data) => {
      const d = data as { discountType?: string; discountValue?: number | null };
      if (d.discountType && d.discountType !== "none") {
        return d.discountValue != null;
      }
      return true;
    },
    { message: "discountValue is required when discountType is not 'none'", path: ["discountValue"] }
  );
}

export const packageCreateSchema = refineDiscount(
  z.object(shape).extend({
    discountType: z.enum(DiscountType).default("none"),
    isActive: z.boolean().default(true),
  })
);

export const packageUpdateSchema = refineDiscount(z.object(shape).partial());
