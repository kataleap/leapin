import { z } from "zod";
import { CountryStatus } from "@/generated/prisma/enums";

// See src/lib/validation/stages.ts for why create/update must not share a
// schema with `.default()` fields.
const shape = {
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  basePrice: z.number().nonnegative(),
  durationMinDays: z.number().int().nonnegative(),
  durationMaxDays: z.number().int().nonnegative(),
  requiredDocuments: z.array(z.string()).optional(),
  poaRequired: z.boolean().optional(),
  status: z.enum(CountryStatus).optional(),
};

export const countryCreateSchema = z.object(shape).extend({
  requiredDocuments: z.array(z.string()).default([]),
  poaRequired: z.boolean().default(false),
  status: z.enum(CountryStatus).default("active"),
});

export const countryUpdateSchema = z.object(shape).partial();
