import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { otpVerifySchema } from "@/lib/auth/schemas";
import { verifyOtp } from "@/lib/otp/service";
import { LoginOtpPurpose } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

// Completes a phone-change challenge started by PUT /api/profile. Doesn't
// go through NextAuth's signIn — the caller already has a session; this
// just applies the staged phone number (verifyOtp does that write itself).
export async function POST(request: Request) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const result = await verifyOtp({ ...parsed.data, expectedUserId: session.user.id });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
  }

  // Ownership is already enforced inside verifyOtp via expectedUserId; this
  // just guards against a "login"-purpose challengeId being replayed here.
  if (result.purpose !== LoginOtpPurpose.phone_change) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
