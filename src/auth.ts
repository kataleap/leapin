import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { JWT } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
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
      }
      return session;
    },
  },
});
