import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrderForViewer } from "@/lib/orders/get-order-for-viewer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const STAGE_STATUS_LABEL: Record<string, string> = {
  not_started: "لم تبدأ",
  in_progress: "قيد التنفيذ",
  waiting_on_client: "بانتظارك",
  waiting_on_government: "بانتظار الجهة الحكومية",
  blocked: "متوقفة",
  completed: "مكتملة",
};

const STAGE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  not_started: "outline",
  in_progress: "secondary",
  waiting_on_client: "secondary",
  waiting_on_government: "secondary",
  blocked: "destructive",
  completed: "default",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "مستحقة",
  paid: "مدفوعة",
  failed: "فشلت",
  refunded: "مُستردة",
};

type Params = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { order, forbidden } = await getOrderForViewer(id, session);
  if (forbidden) notFound();
  if (!order) notFound();

  const activeStages = order.orderStages.filter((os) => os.status !== "skipped");
  const completedCount = activeStages.filter((os) => os.status === "completed").length;
  const progressPercent = activeStages.length > 0 ? Math.round((completedCount / activeStages.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">{order.track.nameAr}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {order.journeyStartStage.nameAr} — {order.journeyEndStage.nameAr}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>التقدّم</CardTitle>
          <CardDescription>
            {completedCount} من {activeStages.length} مراحل مكتملة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercent} />
          <ul className="space-y-2">
            {activeStages.map((os) => (
              <li key={os.id} className="flex items-center justify-between text-sm">
                <span>{os.stage.nameAr}</span>
                <Badge variant={STAGE_STATUS_VARIANT[os.status]}>
                  {STAGE_STATUS_LABEL[os.status] ?? os.status}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الدفعات</CardTitle>
          <CardDescription>الإجمالي: {order.totalPrice ? Number(order.totalPrice).toLocaleString("ar-SA") : "—"} ريال</CardDescription>
        </CardHeader>
        <CardContent>
          {order.orderPayments.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد خطة دفع مرتبطة بهذا الطلب بعد.</p>
          ) : (
            <ul className="space-y-2">
              {order.orderPayments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between text-sm">
                  <span>الدفعة {payment.installmentNumber}</span>
                  <span className="flex items-center gap-2">
                    {Number(payment.amount).toLocaleString("ar-SA")} ريال
                    <Badge variant={payment.status === "paid" ? "default" : "outline"}>
                      {PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {order.tradeNames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>الأسماء التجارية المقترحة</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {order.tradeNames.map((name) => (
                <li key={name.id} className="flex items-center justify-between text-sm">
                  <span>{name.nameAr}</span>
                  <Badge variant={name.status === "approved" ? "default" : "outline"}>{name.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {order.documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>المستندات</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {order.documents.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={`/api/documents/${doc.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm underline"
                  >
                    {doc.originalFileName}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Separator />
      <p className="text-muted-foreground text-xs">تم إنشاء الطلب في {new Date(order.createdAt).toLocaleDateString("ar-SA")}</p>
    </main>
  );
}
