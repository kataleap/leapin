import { z } from "zod";
import { ActivityCategoryStatus } from "@/generated/prisma/enums";

// See src/lib/validation/stages.ts for why create/update must not share a
// schema with `.default()` fields.
const shape = {
  trackId: z.uuid(),
  code: z.string().min(1),
  nameAr: z.string().min(1),
  minForeignCompanies: z.number().int().nonnegative().nullable().optional(),
  minCapitalSar: z.number().nonnegative().nullable().optional(),
  allowedInEntrepreneurship: z.boolean().optional(),
  status: z.enum(ActivityCategoryStatus).optional(),
};

export const activityCategoryCreateSchema = z.object(shape).extend({
  allowedInEntrepreneurship: z.boolean().default(false),
  status: z.enum(ActivityCategoryStatus).default("active"),
});

export const activityCategoryUpdateSchema = z.object(shape).partial();
