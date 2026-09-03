import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/enums";
import type { Session } from "next-auth";

type GuardResult =
  | { session: Session; response: null }
  | { session: null; response: NextResponse };

// Enforced independently of src/proxy.ts's page-level route gating — per the
// doc's RBAC principle (§2.2): "permissions are enforced at the API level,
// not just by hiding UI elements." Every superadmin/admin route handler must
// call this itself.
export async function requireRole(allowedRoles: UserRole[]): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!allowedRoles.includes(session.user.role)) {
    return {
      session: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, response: null };
}

// Any authenticated user, regardless of role — for endpoints any signed-in
// user (client, admin, or super_admin) can use, like journey browsing and
// pricing estimates.
export async function requireAuth(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, response: null };
}
