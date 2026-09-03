import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { credentialsSchema } from "@/lib/auth/schemas";

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

        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (!dbUser || !dbUser.passwordHash || !dbUser.isActive) return null;

        const isValid = await verifyPassword(password, dbUser.passwordHash);
        if (!isValid) return null;

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
