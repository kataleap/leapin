import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// Lean instance: no Prisma adapter, JWT-only session decode from the request
// cookie — no DB call happens on every request. authorize() (which does hit
// Prisma) is never invoked here, only on an actual POST to
// /api/auth/callback/credentials. All gating logic lives in
// authConfig.callbacks.authorized, shared with the full instance in auth.ts.
const { auth } = NextAuth(authConfig);

export { auth as proxy };

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
