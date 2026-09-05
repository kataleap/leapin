import { z } from "zod";
import { UserRole } from "@/generated/prisma/enums";

// This is the mechanism for creating admin/super_admin accounts — per doc
// §2.2, "super admin is the sole party who can create admin accounts."
// Public self-serve /api/auth/register always hardcodes role=client.
export const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  // Required from Phase 5 on — the phone doubles as the mandatory
  // first-login OTP channel, so an admin/super_admin account needs one on
  // file from creation.
  phone: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(UserRole),
});

// Deliberately excludes `phone`: a super_admin editing another user must
// never set their phone directly, since that would bypass the phone_change
// OTP re-verification (doc §3.3). Phone changes only ever happen through
// that user's own profile self-service path.
export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(UserRole).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});
