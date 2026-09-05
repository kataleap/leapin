import { prisma } from "@/lib/prisma";

// System actor used as `AuditLog.actorUserId` for state transitions with no
// human actor — e.g. a payment status change applied by an incoming gateway
// webhook. `AuditLog.actorUserId` is a required FK, so this seeded,
// password-less (can never sign in) user stands in for "the system" rather
// than relaxing that constraint. Seeded in prisma/seed.ts.
export const SYSTEM_USER_EMAIL = "system@leapin.internal";

let cachedSystemUserId: string | null = null;

export async function getSystemUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId;
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: SYSTEM_USER_EMAIL },
    select: { id: true },
  });
  cachedSystemUserId = user.id;
  return cachedSystemUserId;
}
