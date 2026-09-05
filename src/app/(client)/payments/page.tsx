import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentActions } from "@/components/client/payment-actions";

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "مستحقة",
  paid: "مدفوعة",
  failed: "فشلت",
  refunded: "مُستردة",
};

const METHOD_LABEL: Record<string, string> = {
  online: "الكتروني",
  bank_transfer: "تحويل بنكي",
  cash: "كاش",
};

export default async function ClientPaymentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const payments = await prisma.orderPayment.findMany({
    where: { order: { clientId: session.user.id } },
    include: { order: { include: { track: true } } },
    orderBy: [{ order: { createdAt: "desc" } }, { installmentNumber: "asc" }],
  });

  const byOrder = payments.reduce<Record<string, typeof payments>>((acc, p) => {
    (acc[p.orderId] ??= []).push(p);
    return acc;
  }, {});

  const bankDetails = {
    bankName: env.BANK_TRANSFER_BANK_NAME ?? "—",
    accountName: env.BANK_TRANSFER_ACCOUNT_NAME ?? "—",
    iban: env.BANK_TRANSFER_IBAN ?? "—",
  };

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">مدفوعاتي</h1>
        <p className="text-muted-foreground mt-1 text-sm">دفعاتك عبر جميع طلباتك.</p>
      </div>

      {Object.keys(byOrder).length === 0 ? (
        <p className="text-muted-foreground text-sm">لا توجد دفعات على طلباتك حاليًا.</p>
      ) : (
        Object.values(byOrder).map((orderPayments) => (
          <Card key={orderPayments[0].orderId}>
            <CardHeader>
              <CardTitle>{orderPayments[0].order.track.nameAr}</CardTitle>
              <CardDescription>طلب بتاريخ {new Date(orderPayments[0].order.createdAt).toLocaleDateString("ar-SA")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {orderPayments.map((p) => {
                const payable = p.dueAt != null && p.status === "pending";
                const awaitingReview = p.method === "bank_transfer" && p.proofUploadedAt != null && p.status === "pending";
                return (
                  <div key={p.id} className="space-y-2 rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>
                        الدفعة {p.installmentNumber} — {Number(p.amount).toLocaleString("ar-SA")} ريال
                      </span>
                      <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "outline"}>
                        {p.status === "pending" && !p.dueAt
                          ? "غير مستحقة بعد"
                          : (PAYMENT_STATUS_LABEL[p.status] ?? p.status)}
                      </Badge>
                    </div>
                    {p.method && (
                      <p className="text-muted-foreground text-xs">طريقة الدفع: {METHOD_LABEL[p.method] ?? p.method}</p>
                    )}
                    {awaitingReview && (
                      <p className="text-muted-foreground text-xs">تم رفع الإيصال، بانتظار مراجعة الأدمن.</p>
                    )}
                    {payable && !awaitingReview && (
                      <PaymentActions orderId={p.orderId} installmentNumber={p.installmentNumber} bankDetails={bankDetails} />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </main>
  );
}
