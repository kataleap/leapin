import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import type { Session } from "next-auth";

// Doc §2.1/§2.2: a super_admin reaches every order; a plain admin reaches only
// orders they hold at least one stage on. That rule was written out by hand in
// eleven route handlers, which is ten chances for the rule to drift the next
// time it changes — and this one decides who can confirm and refund payments.
//
// Assignment is deliberately order-level, not stage-level: an admin assigned
// to any stage of an order may act on all of that order's payments and
// documents, not only the ones their stage triggered.
export async function canStaffAccessOrder(orderId: string, session: Session): Promise<boolean> {
  if (session.user.role === UserRole.super_admin) return true;
  if (session.user.role !== UserRole.admin) return false;

  const assignment = await prisma.orderStage.findFirst({
    where: { orderId, assignedAdminId: session.user.id },
    select: { id: true },
  });
  return assignment !== null;
}
