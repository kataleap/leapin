import { z } from "zod";
import { ResidencyStatus } from "@/generated/prisma/enums";
import { NATIONALITY_CODES } from "@/lib/reference/nationalities";

// Two separate schemas (not one role-conditional schema), matching the
// existing userCreateSchema/userUpdateSchema split — the route handler
// branches by session.user.role. Neither includes `role`/`isActive`, so
// self-elevation is structurally impossible via this endpoint.
export const clientProfileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  phone: z.string().min(1).optional(),
  // An ISO alpha-3 code, not free text: this value is matched against
  // country_nationality_restrictions.nationality_code, so anything else is
  // silently unmatchable. See src/lib/reference/nationalities.ts.
  nationality: z.enum(NATIONALITY_CODES).optional(),
  residencyStatus: z.enum(ResidencyStatus).optional(),
  nationalIdOrIqama: z.string().trim().min(1).max(30).nullable().optional(),
  addressCountry: z.string().min(1).optional(),
  addressCity: z.string().min(1).optional(),
  addressPostalCode: z.string().min(1).optional(),
});

export const staffProfileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  phone: z.string().min(1).optional(),
});
