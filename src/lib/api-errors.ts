import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

// Shared across all superadmin CRUD routes so each one doesn't reinvent
// Prisma error-code handling.
export function handlePrismaError(err: unknown): NextResponse | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;

  if (err.code === "P2002") {
    return NextResponse.json(
      { error: "A record with the same unique value already exists." },
      { status: 409 }
    );
  }
  if (err.code === "P2003") {
    return NextResponse.json(
      { error: "This action references or is referenced by a record that doesn't exist or can't be changed." },
      { status: 409 }
    );
  }
  if (err.code === "P2025") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return null;
}
