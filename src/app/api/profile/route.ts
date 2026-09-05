import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole, LoginOtpPurpose } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { handlePrismaError } from "@/lib/api-errors";
import { clientProfileUpdateSchema, staffProfileUpdateSchema } from "@/lib/validation/profile";
import { generateAndSendOtp } from "@/lib/otp/service";

// Session-dependent data on a fixed URL — without this, a browser can serve
// a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  phoneVerifiedAt: true,
  pendingPhone: true,
  nationality: true,
  addressCountry: true,
  addressCity: true,
  addressPostalCode: true,
  isActive: true,
  createdAt: true,
} as const;

export async function GET() {
  const { session, response } = await requireAuth();
  if (response) return response;

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: SAFE_SELECT });
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ user });
}

// Self-service profile edit — doc §3.3: fully self-editable, no admin
// approval, EXCEPT phone, which stays on the old value until the new one is
// verified via OTP (it doubles as the login-OTP channel). Every other
// changed field applies immediately in this same call.
export async function PUT(request: Request) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const schema = session.user.role === UserRole.client ? clientProfileUpdateSchema : staffProfileUpdateSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const current = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!current) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { phone: newPhone, ...rest } = parsed.data;
  const phoneChanged = newPhone !== undefined && newPhone !== current.phone;

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: phoneChanged ? { ...rest, pendingPhone: newPhone } : rest,
      select: SAFE_SELECT,
    });

    if (!phoneChanged) {
      return NextResponse.json({ user });
    }

    const { challengeId } = await generateAndSendOtp({
      userId: session.user.id,
      purpose: LoginOtpPurpose.phone_change,
      destinationPhone: newPhone,
      newPhone,
    });
    return NextResponse.json({ user, phoneChangePending: true, challengeId });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
