import { z } from "zod";
import { ResidencyStatus } from "@/generated/prisma/enums";
import { NATIONALITY_CODES } from "@/lib/reference/nationalities";

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
    // Doc §5.1's users table: nationality and residency_status are part of a
    // client record, and both feed the journey rather than sitting as
    // decoration — nationality decides which formation countries are even
    // offered (country_nationality_restrictions), and residency_status
    // decides whether a non-objection letter is required. Collected at
    // registration so no client ever reaches the journey unable to be
    // answered. `national_id_or_iqama` stays optional, as the doc marks it.
    nationality: z.enum(NATIONALITY_CODES),
    residencyStatus: z.enum(ResidencyStatus),
    nationalIdOrIqama: z.string().trim().min(1).max(30).optional(),
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
