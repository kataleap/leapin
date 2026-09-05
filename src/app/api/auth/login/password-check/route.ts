import { NextResponse } from "next/server";
import { verifyUserCredentials } from "@/lib/auth/password";
import { passwordCheckSchema } from "@/lib/auth/schemas";
import { generateAndSendOtp } from "@/lib/otp/service";
import { LoginOtpPurpose } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

// Probes a password without establishing a session (doc §4.2) — lets the
// login page know, before calling the real "credentials" signIn, whether
// this account still needs to complete the mandatory first-login OTP step.
// Having just confirmed the password is correct is exactly the legitimate
// moment to generate and send that OTP code, so this route does both.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = passwordCheckSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 200 });

  const dbUser = await verifyUserCredentials(parsed.data.email, parsed.data.password);
  if (!dbUser) return NextResponse.json({ ok: false }, { status: 200 });

  if (dbUser.phoneVerifiedAt) {
    return NextResponse.json({ ok: true, otpRequired: false });
  }

  if (!dbUser.phone) {
    return NextResponse.json({ ok: false, reason: "no_phone" }, { status: 200 });
  }

  const { challengeId } = await generateAndSendOtp({
    userId: dbUser.id,
    purpose: LoginOtpPurpose.login,
    destinationPhone: dbUser.phone,
  });

  return NextResponse.json({ ok: true, otpRequired: true, challengeId });
}
