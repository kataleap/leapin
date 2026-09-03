import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const registerSchema = credentialsSchema
  .extend({
    name: z.string().min(1),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
