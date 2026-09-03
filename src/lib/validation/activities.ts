import { z } from "zod";

// See src/lib/validation/stages.ts for why create/update must not share a
// schema with `.default()` fields.
const shape = {
  categoryId: z.uuid(),
  misaActivityCode: z.string().min(1),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  isActive: z.boolean().optional(),
};

export const activityCreateSchema = z.object(shape).extend({
  isActive: z.boolean().default(true),
});

export const activityUpdateSchema = z.object(shape).partial();
