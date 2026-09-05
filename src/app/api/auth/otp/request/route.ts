import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { otpRequestSchema } from "@/lib/auth/schemas";
import { generateAndSendOtp } from "@/lib/otp/service";
import { LoginOtpPurpose } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

// The always-available "log in via OTP instead of password" path (doc §4.2
// row 3) — deliberately requires phoneVerifiedAt already set, so it can't
// be used to skip the mandatory first-login OTP gate (that path only ever
// goes through /api/auth/login/password-check, which proves the password
// first). Always responds the same shape regardless of whether the
// account/condition matched, to avoid leaking which emails exist.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = otpRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true, challengeId: randomUUID() });

  const dbUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (dbUser && dbUser.isActive && dbUser.phoneVerifiedAt && dbUser.phone) {
    const { challengeId } = await generateAndSendOtp({
      userId: dbUser.id,
      purpose: LoginOtpPurpose.login,
      destinationPhone: dbUser.phone,
    });
    return NextResponse.json({ ok: true, challengeId });
  }

  return NextResponse.json({ ok: true, challengeId: randomUUID() });
}
