import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { AdminOrderPanel } from "@/components/admin/admin-order-panel";

type Params = { params: Promise<{ id: string }> };

export default async function AdminOrderDetailPage({ params }: Params) {
  const session = await requirePageRole([UserRole.admin, UserRole.super_admin]);

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      track: true,
      client: true,
      orderStages: { include: { stage: true }, orderBy: { stage: { sequenceOrder: "asc" } } },
      documents: true,
      tradeNames: { orderBy: [{ batchNumber: "asc" }, { priorityRank: "asc" }] },
      orderPayments: { orderBy: { installmentNumber: "asc" } },
      notificationLogs: { orderBy: { sentAt: "desc" } },
    },
  });
  if (!order) notFound();

  const isSuperAdmin = session.user.role === UserRole.super_admin;
  // Per doc §2.1: a plain admin only ever accesses orders assigned to them.
  if (!isSuperAdmin) {
    const isAssigned = order.orderStages.some((s) => s.assignedAdminId === session.user.id);
    if (!isAssigned) notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{order.track.nameAr}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {order.client.name} — {order.client.email}
        </p>
      </div>
      <AdminOrderPanel
        orderId={order.id}
        isSuperAdmin={isSuperAdmin}
        currentUserId={session.user.id}
        initialStages={order.orderStages}
        initialDocuments={order.documents}
        initialTradeNames={order.tradeNames}
        initialOrderPayments={order.orderPayments.map((p) => ({ ...p, amount: Number(p.amount) }))}
        initialNotificationLogs={order.notificationLogs}
      />
    </div>
  );
}
