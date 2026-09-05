import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { UserRole, LoginOtpPurpose } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { verifyUserCredentials } from "@/lib/auth/password";
import { credentialsSchema, otpVerifySchema } from "@/lib/auth/schemas";
import { verifyOtp } from "@/lib/otp/service";

// Lean config shared between src/auth.ts (full server config, adds the
// Prisma adapter) and src/proxy.ts (route protection via the `authorized`
// callback below — authorize() itself only runs on an actual credentials
// sign-in POST, never during ordinary proxy route checks).
export default {
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const dbUser = await verifyUserCredentials(email, password);
        if (!dbUser) return null;

        // Belt-and-suspenders (doc §4.2): a never-verified account must
        // never authenticate via plain password, no matter what the client
        // calls directly — the client is only supposed to reach this
        // provider after /api/auth/login/password-check has confirmed
        // phoneVerifiedAt is already set. Enforcing it here too means a
        // client that skips the probe (or a stale phoneVerifiedAt=null row)
        // can't bypass the mandatory first-login OTP step.
        if (!dbUser.phoneVerifiedAt) return null;

        // Explicit local variable typed via next-auth's augmented `User`
        // (see src/types/next-auth.d.ts) rather than an inline object
        // literal — avoids any excess-property-check surprise.
        const authorizedUser: User = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
        };
        return authorizedUser;
      },
    }),
    Credentials({
      id: "otp",
      credentials: { challengeId: {}, code: {} },
      async authorize(credentials) {
        const parsed = otpVerifySchema.safeParse(credentials);
        if (!parsed.success) return null;

        const result = await verifyOtp(parsed.data);
        // A phone_change challenge must never be replayable into a session —
        // only a "login" challenge is allowed to authenticate.
        if (!result.ok || result.purpose !== LoginOtpPurpose.login) return null;

        const dbUser = await prisma.user.findUnique({ where: { id: result.userId } });
        if (!dbUser || !dbUser.isActive) return null;

        const authorizedUser: User = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
        };
        return authorizedUser;
      },
    }),
  ],
  callbacks: {
    // Shared with src/proxy.ts's lean NextAuth instance as well as the full
    // one in src/auth.ts — both must propagate `role` onto the token/session
    // identically, otherwise the proxy's session decode never sees `role`
    // and authorized() below silently blocks every real user.
    async jwt({ token, user }): Promise<JWT> {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      const jwt = token as JWT;
      if (session.user) {
        session.user.role = jwt.role;
        if (jwt.sub) session.user.id = jwt.sub;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      const { pathname } = nextUrl;

      if (pathname.startsWith("/superadmin")) {
        return isLoggedIn && role === UserRole.super_admin;
      }
      if (pathname.startsWith("/admin")) {
        return isLoggedIn && (role === UserRole.admin || role === UserRole.super_admin);
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
