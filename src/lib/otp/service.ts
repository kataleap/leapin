import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getOtpProvider, OtpProviderError } from "@/lib/otp";
import { LoginOtpPurpose } from "@/generated/prisma/enums";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Shared by every trigger point that needs an OTP sent (login's
// password-check probe, the always-available otp/request alt-login path,
// and a profile phone change) — generates the code, persists it hashed, and
// sends it. Mirrors send-external-notification.ts's contract: the send
// itself never throws out past the caller, since a delivery failure must
// not break the flow that triggered it (the row still exists either way,
// so a resend attempt just requests a fresh code).
export async function generateAndSendOtp(params: {
  userId: string;
  purpose: LoginOtpPurpose;
  destinationPhone: string;
  newPhone?: string;
}): Promise<{ challengeId: string }> {
  const { userId, purpose, destinationPhone, newPhone } = params;
  const code = generateCode();
  const codeHash = await hashPassword(code);

  const row = await prisma.loginOtpCode.create({
    data: {
      userId,
      purpose,
      codeHash,
      newPhone: purpose === LoginOtpPurpose.phone_change ? newPhone : undefined,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  try {
    await getOtpProvider().sendOtp({ to: destinationPhone, code });
  } catch (err) {
    console.error("[otp] failed to send code", {
      userId,
      purpose,
      err: err instanceof OtpProviderError ? err.message : err,
    });
  }

  return { challengeId: row.id };
}

export type VerifyOtpResult =
  | { ok: true; userId: string; purpose: LoginOtpPurpose; newPhone: string | null }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "wrong_code" };

// Consumes a challenge: on a correct code, marks it used and applies the
// purpose-specific side effect (proving phone ownership for a login
// challenge, or committing a staged phone number for a phone_change
// challenge) in the same transaction as the write, so a crash between
// "code verified" and "effect applied" can't happen.
//
// `expectedUserId` is required for any caller that already has a session
// (the profile phone-change verify route) — without it, one logged-in user
// could complete another user's pending phone_change challenge just by
// guessing/observing its challengeId+code. The NextAuth "otp" login
// provider omits it since it has no session yet (the challenge itself is
// the only proof of identity at that point).
export async function verifyOtp(params: {
  challengeId: string;
  code: string;
  expectedUserId?: string;
}): Promise<VerifyOtpResult> {
  const { challengeId, code, expectedUserId } = params;

  const row = await prisma.loginOtpCode.findUnique({ where: { id: challengeId } });
  if (!row) return { ok: false, reason: "not_found" };
  // Checked before touching the row at all — a mismatched owner must not be
  // able to burn the real owner's attempt count or consume their code.
  if (expectedUserId && row.userId !== expectedUserId) return { ok: false, reason: "not_found" };
  if (row.consumedAt) return { ok: false, reason: "not_found" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const isValid = await verifyPassword(code, row.codeHash);
  if (!isValid) {
    await prisma.loginOtpCode.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
    return { ok: false, reason: "wrong_code" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.loginOtpCode.update({ where: { id: challengeId }, data: { consumedAt: new Date() } });

    if (row.purpose === LoginOtpPurpose.login) {
      await tx.user.updateMany({
        where: { id: row.userId, phoneVerifiedAt: null },
        data: { phoneVerifiedAt: new Date() },
      });
    } else if (row.purpose === LoginOtpPurpose.phone_change && row.newPhone) {
      await tx.user.update({
        where: { id: row.userId },
        data: { phone: row.newPhone, phoneVerifiedAt: new Date(), pendingPhone: null },
      });
    }
  });

  return { ok: true, userId: row.userId, purpose: row.purpose, newPhone: row.newPhone };
}
