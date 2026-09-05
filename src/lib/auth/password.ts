import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Shared by the "credentials" NextAuth provider (src/auth.config.ts) and the
// password-check probe route (src/app/api/auth/login/password-check) — both
// need the exact same lookup+verify, and drift between the two would be a
// security bug (e.g. one checking isActive and the other not).
export async function verifyUserCredentials(email: string, password: string): Promise<User | null> {
  const dbUser = await prisma.user.findUnique({ where: { email } });
  if (!dbUser || !dbUser.passwordHash || !dbUser.isActive) return null;

  const isValid = await verifyPassword(password, dbUser.passwordHash);
  if (!isValid) return null;

  return dbUser;
}
