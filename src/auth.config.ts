import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

// Lean config shared between src/auth.ts (full server config, adds the
// Prisma adapter) and src/proxy.ts. No real login or authorization logic
// yet — this establishes the file boundary for later steps.
export default {
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize() {
        throw new Error(
          "Credentials login is not implemented yet — lands in a later step."
        );
      },
    }),
  ],
  callbacks: {
    authorized() {
      // Placeholder — real role-based route protection is a later step.
      return true;
    },
  },
} satisfies NextAuthConfig;
