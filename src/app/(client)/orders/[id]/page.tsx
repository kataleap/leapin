import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrderForViewer } from "@/lib/orders/get-order-for-viewer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT, ORDER_STATUS_HINT } from "@/lib/orders/status-labels";
import {
  canClientUploadDocuments,
  canClientSubmitTradeNames,
  stagesWaitingOnClient,
} from "@/lib/orders/client-actions";
import { ClientOrderActions } from "@/components/client/client-order-actions";
import { canClientSubmitNonObjectionLetter } from "@/lib/orders/non-objection";
import { STAGE_STATUS_LABEL, STAGE_STATUS_VARIANT } from "@/lib/orders/stage-labels";
import { buildOrderTimeline } from "@/lib/orders/timeline";
import { formatOrderNumber } from "@/lib/orders/order-number";

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
  // Staff opening a client's order through this page get the read-only view;
  // the action panel belongs to the person who actually owes the action.
  const isOwnerClient = order.clientId === session.user.id;
  const waitingStageNames = stagesWaitingOnClient(activeStages).map((os) => os.stage.nameAr);
  // Orders created before the letter's lifecycle existed have no row; treat
  // that as "no requirement recorded" rather than rendering a broken panel.
  const letter = order.nonObjectionLetters[0] ?? null;
  const timeline = buildOrderTimeline(order);
  const completedCount = activeStages.filter((os) => os.status === "completed").length;
  const progressPercent = activeStages.length > 0 ? Math.round((completedCount / activeStages.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{order.track.nameAr}</h1>
          <Badge variant={ORDER_STATUS_VARIANT[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
          <span className="text-muted-foreground font-mono text-sm">
            {formatOrderNumber(order.orderNumber)}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {order.journeyStartStage.nameAr} — {order.journeyEndStage.nameAr}
        </p>
        <p className="text-muted-foreground mt-2 text-sm">{ORDER_STATUS_HINT[order.status]}</p>
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
                  {STAGE_STATUS_LABEL[os.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {isOwnerClient && (
        <ClientOrderActions
          orderId={order.id}
          waitingStageNames={waitingStageNames}
          canUploadDocuments={canClientUploadDocuments(order.status)}
          canSubmitTradeNames={canClientSubmitTradeNames(order.status, order.tradeNames)}
          canSubmitNonObjectionLetter={
            letter
              ? canClientSubmitNonObjectionLetter(letter)
              : { allowed: false, reason: "لا يوجد اشتراط خطاب عدم ممانعة على هذا الطلب." }
          }
          nonObjectionLetter={
            letter
              ? {
                  isRequired: letter.isRequired,
                  status: letter.status,
                  reviewNote: letter.reviewNote,
                  documentId: letter.documentId,
                  documentName: letter.document?.originalFileName ?? null,
                }
              : null
          }
        />
      )}

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
                    {payment.status === "paid" && (
                      <a
                        href={`/orders/${order.id}/payments/${payment.installmentNumber}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-xs underline"
                      >
                        إيصال
                      </a>
                    )}
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
                <li key={doc.id} className="flex items-center justify-between gap-3">
                  <a
                    href={`/api/documents/${doc.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm underline"
                  >
                    {doc.originalFileName}
                  </a>
                  <span className="text-muted-foreground text-xs">
                    {doc.uploadedByClientId ? "رفعته أنت" : "من فريقنا"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>سجل الطلب</CardTitle>
          <CardDescription>كل ما جرى على طلبك، الأحدث أولًا</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {timeline.map((event, index) => (
              <li key={index} className="flex items-start justify-between gap-4 text-sm">
                <span>
                  <span className="block">{event.title}</span>
                  {event.detail && (
                    <span className="text-muted-foreground block text-xs">{event.detail}</span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {new Date(event.at).toLocaleString("ar-SA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Separator />
      <p className="text-muted-foreground text-xs">تم إنشاء الطلب في {new Date(order.createdAt).toLocaleDateString("ar-SA")}</p>
    </main>
  );
}
