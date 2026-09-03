import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orders = await prisma.order.findMany({
    where: session.user.role === UserRole.client ? { clientId: session.user.id } : undefined,
    include: { track: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">طلباتي</h1>
        <Link href="/journey" className="text-primary text-sm underline">
          طلب جديد
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">لا توجد طلبات بعد.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="hover:ring-primary/40 transition-shadow">
                <CardHeader>
                  <CardTitle>{order.track.nameAr}</CardTitle>
                  <CardDescription>
                    {order.totalPrice
                      ? `${Number(order.totalPrice).toLocaleString("ar-SA")} ريال`
                      : "قيد الحساب"}
                  </CardDescription>
                  <CardAction>
                    <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                      {order.status}
                    </Badge>
                  </CardAction>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
