import { prisma } from "@/lib/prisma";
import { UserRole, type NotificationType } from "@/generated/prisma/enums";

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

export async function notifySuperAdmins(params: {
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
}) {
  const superAdmins = await prisma.user.findMany({
    where: { role: UserRole.super_admin, isActive: true },
    select: { id: true },
  });
  if (superAdmins.length === 0) return;
  await prisma.notification.createMany({
    data: superAdmins.map((u) => ({ userId: u.id, ...params })),
  });
}
