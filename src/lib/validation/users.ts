import { z } from "zod";
import { UserRole } from "@/generated/prisma/enums";

// This is the mechanism for creating admin/super_admin accounts — per doc
// §2.2, "super admin is the sole party who can create admin accounts."
// Public self-serve /api/auth/register always hardcodes role=client.
export const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(UserRole),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(UserRole).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});
