import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT } from "@/lib/orders/status-labels";
import { formatOrderNumber } from "@/lib/orders/order-number";

// Assignment is manual and super-admin-only (doc §2.2), and nothing surfaced
// the orders still waiting for it: a new order notified the super admins once,
// and after that notification scrolled away the order was reachable only by
// knowing it existed. A plain admin cannot even open it — `canStaffAccessOrder`
// requires a stage assignment — so an unassigned order is an order nobody is
// working on.
//
// This is the visibility half only. Which admin gets which order, and how long
// an order may wait before it escalates, are policy decisions for the product
// owner, not defaults to invent here.

const DAY_MS = 24 * 60 * 60 * 1000;

function waitingLabel(createdAt: Date): { text: string; urgent: boolean } {
  const days = Math.floor((Date.now() - createdAt.getTime()) / DAY_MS);
  if (days < 1) return { text: "منذ أقل من يوم", urgent: false };
  if (days === 1) return { text: "منذ يوم واحد", urgent: false };
  if (days === 2) return { text: "منذ يومين", urgent: true };
  return { text: `منذ ${days} أيام`, urgent: true };
}

export default async function UnassignedOrdersPage() {
  await requirePageRole([UserRole.super_admin]);

  const orders = await prisma.order.findMany({
    // An order is unassigned while not one of its stages has an admin on it.
    where: {
      status: { notIn: ["completed", "cancelled"] },
      orderStages: { none: { assignedAdminId: { not: null } } },
    },
    include: { track: true, client: { select: { name: true, email: true } } },
    // Oldest first: the one that has been waiting longest is the one that
    // needs a decision most.
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">طلبات غير مسندة</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          طلبات نشطة لا يحمل أي أدمن مرحلة منها — لا أحد يعمل عليها حتى تُسند.
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">لا توجد طلبات غير مسندة. 👍</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const waiting = waitingLabel(order.createdAt);
            return (
              <Link key={order.id} href={`/admin/orders/${order.id}`}>
                <Card className={waiting.urgent ? "border-destructive" : undefined}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono text-sm">
                        {formatOrderNumber(order.orderNumber)}
                      </span>
                      <span>{order.track.nameAr}</span>
                    </CardTitle>
                    <CardDescription>
                      {order.client.name} — {order.client.email} · بانتظار الإسناد {waiting.text}
                    </CardDescription>
                    <CardAction>
                      <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
