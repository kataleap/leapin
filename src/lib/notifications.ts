import { prisma } from "@/lib/prisma";
import { UserRole, type NotificationType } from "@/generated/prisma/enums";
import { SYSTEM_USER_EMAIL } from "@/lib/system-user";

// In-app only, per doc §10.2's requirement ("notifications to the client on
// any stage status change, and to admins on a new order or an action
// awaiting them") — email/WhatsApp delivery is a separate, later
// integration that needs external provider accounts.
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
}) {
  await prisma.notification.create({ data: params });
}

// A client action lands on whoever is actually holding the order — the admins
// assigned to its stages. With nothing assigned yet (the state every new order
// starts in, since assignment is manual), it falls back to the super admins so
// a client's document never sits in a vault no one was told about.
export async function notifyOrderStaff(
  orderId: string,
  params: { type: NotificationType; title: string; message: string }
) {
  const assigned = await prisma.orderStage.findMany({
    where: { orderId, assignedAdminId: { not: null } },
    select: { assignedAdminId: true },
    distinct: ["assignedAdminId"],
  });
  const recipientIds = assigned
    .map((s) => s.assignedAdminId)
    .filter((id): id is string => id !== null);

  if (recipientIds.length === 0) {
    await notifySuperAdmins({ ...params, orderId });
    return;
  }
  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({ userId, orderId, ...params })),
  });
}

export async function notifySuperAdmins(params: {
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
}) {
  const superAdmins = await prisma.user.findMany({
    // The system actor is a seeded, password-less super_admin that stands in
    // for "the system" in audit rows (see src/lib/system-user.ts). It has no
    // inbox and nobody reads for it, so every notify-the-super-admins call
    // was quietly writing a second, unread copy of itself.
    where: { role: UserRole.super_admin, isActive: true, email: { not: SYSTEM_USER_EMAIL } },
    select: { id: true },
  });
  if (superAdmins.length === 0) return;
  await prisma.notification.createMany({
    data: superAdmins.map((u) => ({ userId: u.id, ...params })),
  });
}
