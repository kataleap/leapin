import { z } from "zod";

export const estimateSchema = z.object({
  trackId: z.uuid(),
  packageId: z.uuid().nullable().optional(),
  startStageId: z.uuid().nullable().optional(),
  endStageId: z.uuid().nullable().optional(),
  countryId: z.uuid().nullable().optional(),
});

export const orderCreateSchema = estimateSchema.extend({
  activityCategoryId: z.uuid().nullable().optional(),
  activityIds: z.array(z.uuid()).optional(),
  paymentPlanId: z.uuid().nullable().optional(),
});
