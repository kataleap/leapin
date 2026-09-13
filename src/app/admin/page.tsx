import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT } from "@/lib/orders/status-labels";
import { formatOrderNumber } from "@/lib/orders/order-number";

export default async function AdminHomePage() {
  const session = await requirePageRole([UserRole.admin, UserRole.super_admin]);

  const orders = await prisma.order.findMany({
    where:
      session.user.role === UserRole.admin
        ? { orderStages: { some: { assignedAdminId: session.user.id } } }
        : undefined,
    include: { track: true, client: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">لوحة الأدمن</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {session.user.role === UserRole.admin ? "الطلبات المُسندة إليك" : "جميع الطلبات"}
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">لا توجد طلبات حاليًا.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/admin/orders/${order.id}`}>
              <Card className="hover:ring-primary/40 transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-sm">
                      {formatOrderNumber(order.orderNumber)}
                    </span>
                    <span>{order.track.nameAr}</span>
                  </CardTitle>
                  <CardDescription>{order.client.name} — {order.client.email}</CardDescription>
                  <CardAction>
                    <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
                      {ORDER_STATUS_LABEL[order.status]}
                    </Badge>
                  </CardAction>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
