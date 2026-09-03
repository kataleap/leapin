import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "مسوّدة",
  pending_payment: "بانتظار الدفع",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغى",
  on_hold: "معلّق",
};

function riyal(value: number) {
  return `${value.toLocaleString("ar-SA")} ريال`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="mt-1 text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function BarRow({ label, value, max, format }: { label: string; value: number; max: number; format?: (v: number) => string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 truncate text-muted-foreground">{label}</span>
      <div className="flex-1">
        <div className="h-4 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-28 shrink-0 text-end font-medium tabular-nums">
        {format ? format(value) : value.toLocaleString("ar-SA")}
      </span>
    </div>
  );
}

function BarChartCard({
  title,
  description,
  rows,
  format,
}: {
  title: string;
  description?: string;
  rows: { label: string; value: number }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">لا توجد بيانات بعد.</p>
        ) : (
          rows.map((row) => (
            <BarRow key={row.label} label={row.label} value={row.value} max={max} format={format} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default async function ReportsPage() {
  const [
    totalOrders,
    totalValueAgg,
    collectedAgg,
    pendingAgg,
    ordersByStatus,
    ordersByTrack,
    revenueByPackage,
    stuckStages,
    adminWorkload,
    tracks,
    packages,
    stages,
    admins,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { totalPrice: true }, where: { status: { not: "cancelled" } } }),
    prisma.orderPayment.aggregate({ _sum: { amount: true }, where: { status: "paid" } }),
    prisma.orderPayment.aggregate({ _sum: { amount: true }, where: { status: "pending" } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.groupBy({ by: ["trackId"], _count: { _all: true } }),
    prisma.order.groupBy({
      by: ["selectedPackageId"],
      _sum: { totalPrice: true },
      where: { selectedPackageId: { not: null } },
    }),
    prisma.orderStage.groupBy({
      by: ["stageId"],
      _count: { _all: true },
      where: { status: { in: ["blocked", "waiting_on_government", "waiting_on_client"] } },
    }),
    prisma.orderStage.groupBy({
      by: ["assignedAdminId"],
      _count: { _all: true },
      where: { assignedAdminId: { not: null } },
    }),
    prisma.track.findMany({ select: { id: true, nameAr: true } }),
    prisma.package.findMany({ select: { id: true, nameAr: true } }),
    prisma.stage.findMany({ select: { id: true, nameAr: true } }),
    prisma.user.findMany({ where: { role: { in: ["admin", "super_admin"] } }, select: { id: true, name: true } }),
  ]);

  const trackName = (id: string) => tracks.find((t) => t.id === id)?.nameAr ?? id;
  const packageName = (id: string) => packages.find((p) => p.id === id)?.nameAr ?? id;
  const stageName = (id: string) => stages.find((s) => s.id === id)?.nameAr ?? id;
  const adminName = (id: string) => admins.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">التقارير</h1>
        <p className="text-muted-foreground mt-1 text-sm">مؤشرات مالية وتشغيلية عامة</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="إجمالي الطلبات" value={totalOrders.toLocaleString("ar-SA")} />
        <StatTile label="إجمالي قيمة الطلبات" value={riyal(Number(totalValueAgg._sum.totalPrice ?? 0))} />
        <StatTile label="المبلغ المُحصَّل" value={riyal(Number(collectedAgg._sum.amount ?? 0))} />
        <StatTile label="المبلغ المعلّق" value={riyal(Number(pendingAgg._sum.amount ?? 0))} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <BarChartCard
          title="الطلبات حسب الحالة"
          rows={ordersByStatus.map((r) => ({
            label: ORDER_STATUS_LABEL[r.status] ?? r.status,
            value: r._count._all,
          }))}
        />
        <BarChartCard
          title="الطلبات حسب المسار"
          rows={ordersByTrack.map((r) => ({ label: trackName(r.trackId), value: r._count._all }))}
        />
        <BarChartCard
          title="الإيراد حسب الباقة"
          description="مجموع قيمة الطلبات لكل باقة"
          format={riyal}
          rows={revenueByPackage
            .map((r) => ({ label: packageName(r.selectedPackageId as string), value: Number(r._sum.totalPrice ?? 0) }))
            .sort((a, b) => b.value - a.value)}
        />
        <BarChartCard
          title="مراحل متعثّرة"
          description="مراحل بحالة: متوقفة / بانتظار جهة حكومية / بانتظار العميل"
          rows={stuckStages
            .map((r) => ({ label: stageName(r.stageId), value: r._count._all }))
            .sort((a, b) => b.value - a.value)}
        />
      </div>

      <BarChartCard
        title="عبء العمل حسب الأدمن"
        description="عدد المراحل المُسندة لكل أدمن"
        rows={adminWorkload
          .map((r) => ({ label: adminName(r.assignedAdminId as string), value: r._count._all }))
          .sort((a, b) => b.value - a.value)}
      />
    </div>
  );
}
