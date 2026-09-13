import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { AdminOrderPanel } from "@/components/admin/admin-order-panel";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT } from "@/lib/orders/status-labels";
import { formatOrderNumber } from "@/lib/orders/order-number";
import { sessionHasAccountingAccess } from "@/lib/auth/accounting";
import { resolveOrderAccess } from "@/lib/orders/accounting-access";

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
      nonObjectionLetters: { include: { document: true } },
    },
  });
  if (!order) notFound();

  const isSuperAdmin = session.user.role === UserRole.super_admin;
  // Per doc §2.1: a plain admin only ever accesses orders assigned to them.
  // Phase 6 §5.5 widens this by one case — an accounting account arriving
  // from the accounting screen — and by one case only: `access.viaAccounting`
  // below then strips the panel back to what §4 permits.
  const isAssignedStaff =
    isSuperAdmin || order.orderStages.some((s) => s.assignedAdminId === session.user.id);
  const access = resolveOrderAccess({
    isAssignedStaff,
    hasAccounting: await sessionHasAccountingAccess(session),
  });
  if (!access.canView) notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{order.track.nameAr}</h1>
          <span className="text-muted-foreground font-mono text-sm">
            {formatOrderNumber(order.orderNumber)}
          </span>
          <Badge variant={ORDER_STATUS_VARIANT[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {order.client.name} — {order.client.email}
        </p>
      </div>
      <AdminOrderPanel
        orderId={order.id}
        isSuperAdmin={isSuperAdmin}
        accountingOnly={access.viaAccounting}
        currentUserId={session.user.id}
        initialStages={order.orderStages}
        initialDocuments={order.documents}
        initialTradeNames={order.tradeNames}
        initialOrderPayments={order.orderPayments.map((p) => ({ ...p, amount: Number(p.amount) }))}
        initialNotificationLogs={order.notificationLogs}
        initialNonObjectionLetter={
          order.nonObjectionLetters[0]
            ? {
                isRequired: order.nonObjectionLetters[0].isRequired,
                status: order.nonObjectionLetters[0].status,
                reviewNote: order.nonObjectionLetters[0].reviewNote,
                documentId: order.nonObjectionLetters[0].documentId,
                documentName: order.nonObjectionLetters[0].document?.originalFileName ?? null,
              }
            : null
        }
      />
    </div>
  );
}
