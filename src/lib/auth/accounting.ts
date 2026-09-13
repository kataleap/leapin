import { cache } from "react";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";

// Phase 6 §3.1 — the accounting flag is read from the database on every
// check, never carried on the JWT.
//
// Putting it on the token would have been one fewer query, at the cost of a
// revoked accounting permission staying live until that session's token
// expired. For a permission whose whole point is reaching every client's
// money, the revocation has to take effect on the next request. React's
// cache() collapses the repeated reads within a single render — the admin
// layout and the page it wraps both ask — so the real cost is one query per
// request, not per call site.
const readFlag = cache(async (userId: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasAccountingAccess: true, isActive: true, role: true },
  });
  if (!user || !user.isActive) return false;
  // Defence in depth against a stale row: the flag only ever means
  // anything on a staff account.
  if (user.role !== UserRole.admin && user.role !== UserRole.super_admin) return false;
  return user.hasAccountingAccess;
});

export async function sessionHasAccountingAccess(session: Session | null): Promise<boolean> {
  if (!session?.user?.id) return false;
  if (session.user.role !== UserRole.admin && session.user.role !== UserRole.super_admin) {
    return false;
  }
  return readFlag(session.user.id);
}
