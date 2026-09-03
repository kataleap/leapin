import { z } from "zod";

const shape = {
  baseCategoryId: z.uuid(),
  addableCategoryId: z.uuid(),
  isAllowed: z.boolean().optional(),
};

export const activityMixingRuleCreateSchema = z.object(shape).extend({
  isAllowed: z.boolean().default(true),
});

export const activityMixingRuleUpdateSchema = z.object({
  isAllowed: z.boolean(),
});
