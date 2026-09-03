import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import type { Session } from "next-auth";

// Shared between the API route and the order-tracking Server Component page
// so the visibility rules (own-order-only for clients, document filtering)
// live in exactly one place.
export async function getOrderForViewer(orderId: string, session: Session) {
  const isClient = session.user.role === UserRole.client;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      track: true,
      activityCategory: true,
      selectedPackage: true,
      journeyStartStage: true,
      journeyEndStage: true,
      orderStages: { include: { stage: true }, orderBy: { stage: { sequenceOrder: "asc" } } },
      orderPayments: true,
      tradeNames: { orderBy: [{ batchNumber: "asc" }, { priorityRank: "asc" }] },
      // A client only ever sees documents an admin has marked visible to them.
      documents: isClient ? { where: { isVisibleToClient: true } } : true,
    },
  });
  if (!order) return { order: null, forbidden: false } as const;

  // A client may only view their own order; staff may view any.
  if (isClient && order.clientId !== session.user.id) {
    return { order: null, forbidden: true } as const;
  }

  return { order, forbidden: false } as const;
}
