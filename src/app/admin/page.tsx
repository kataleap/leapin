import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">لوحة الأدمن</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {session.user.role === UserRole.admin ? "الطلبات المُسندة إليك" : "جميع الطلبات"}
          </p>
        </div>
        <SignOutButton />
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">لا توجد طلبات حاليًا.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/admin/orders/${order.id}`}>
              <Card className="hover:ring-primary/40 transition-shadow">
                <CardHeader>
                  <CardTitle>{order.track.nameAr}</CardTitle>
                  <CardDescription>{order.client.name} — {order.client.email}</CardDescription>
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
    </div>
  );
}
