import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";

// Per-user data on a fixed URL — confirmed in testing that without an
// explicit no-store, a browser can reuse a previous user's cached response
// for this same path after a different user signs in.
export const dynamic = "force-dynamic";

export async function GET() {
  const { session, response } = await requireAuth();
  if (response) return response;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: session.user.id, isRead: false } }),
  ]);
  return NextResponse.json(
    { notifications, unreadCount },
    { headers: { "Cache-Control": "no-store" } }
  );
}
