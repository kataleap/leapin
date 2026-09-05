import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/enums";
import type { Session } from "next-auth";

// The Server Component counterpart to requireRole() in ./guards.ts, which
// serves API routes: same rule, but a redirect instead of a 403 body, since a
// page's caller is a browser navigation rather than a fetch.
//
// This deliberately duplicates the gating that src/proxy.ts's `authorized`
// callback already performs on the /admin and /superadmin prefixes. Next.js's
// own documentation is explicit that the proxy layer "should not be used as a
// full session management or authorization solution" — it is an optimistic
// check, one layer, and pages here read directly from Prisma. Anything that
// bypasses or misconfigures the proxy (a matcher edit, a header-forging
// bypass of the kind Next.js has shipped advisories for) would otherwise
// expose revenue reports and the full user list to an anonymous request.
//
// Every page under /admin and /superadmin must call this as its first
// statement, mirroring the API-level rule stated in ./guards.ts.
export async function requirePageRole(allowedRoles: UserRole[]): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Signed in but wrong role: send them to their own area rather than the
  // login page, which would otherwise loop for an already-valid session.
  if (!allowedRoles.includes(session.user.role)) redirect("/");
  return session;
}
