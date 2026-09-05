import { z } from "zod";

// Two separate schemas (not one role-conditional schema), matching the
// existing userCreateSchema/userUpdateSchema split — the route handler
// branches by session.user.role. Neither includes `role`/`isActive`, so
// self-elevation is structurally impossible via this endpoint.
export const clientProfileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  phone: z.string().min(1).optional(),
  nationality: z.string().min(1).optional(),
  addressCountry: z.string().min(1).optional(),
  addressCity: z.string().min(1).optional(),
  addressPostalCode: z.string().min(1).optional(),
});

export const staffProfileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  phone: z.string().min(1).optional(),
});
