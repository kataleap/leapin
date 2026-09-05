import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const registerSchema = credentialsSchema
  .extend({
    name: z.string().min(1),
    // Required from this phase on — the phone doubles as the mandatory
    // first-login OTP channel (doc §4), so it must exist before a first
    // login can ever complete.
    phone: z.string().min(1),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const passwordCheckSchema = credentialsSchema;

export const otpVerifySchema = z.object({
  challengeId: z.uuid(),
  code: z.string().length(6),
});

export const otpRequestSchema = z.object({ email: z.email() });
