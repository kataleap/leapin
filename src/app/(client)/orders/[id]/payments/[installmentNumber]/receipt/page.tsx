import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { formatOrderNumber } from "@/lib/orders/order-number";

// A receipt the client can keep. Rendered as a print-styled page rather than a
// generated PDF: the browser's own "print to PDF" produces the same artefact
// without adding a PDF toolchain to the server, and the page stays readable
// (and re-checkable against live data) instead of being a frozen binary.

const METHOD_LABEL: Record<string, string> = {
  online: "دفع إلكتروني",
  bank_transfer: "تحويل بنكي",
  cash: "نقدًا",
};

type Params = { params: Promise<{ id: string; installmentNumber: string }> };

export default async function ReceiptPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: orderId, installmentNumber } = await params;
  const parsedNumber = Number(installmentNumber);
  if (!Number.isInteger(parsedNumber)) notFound();

  const payment = await prisma.orderPayment.findUnique({
    where: { orderId_installmentNumber: { orderId, installmentNumber: parsedNumber } },
    include: {
      order: {
        include: { track: true, client: { select: { name: true, email: true, nationalIdOrIqama: true } } },
      },
    },
  });
  if (!payment) notFound();

  // Same rule as everywhere else: the client sees their own, staff see what
  // they are assigned to.
  const isOwnerClient =
    session.user.role === UserRole.client && payment.order.clientId === session.user.id;
  if (!isOwnerClient) {
    const isStaff = session.user.role === UserRole.admin || session.user.role === UserRole.super_admin;
    if (!isStaff || !(await canStaffAccessOrder(orderId, session))) notFound();
  }

  // A receipt is proof that money was received. There is nothing to attest to
  // until it has been.
  if (payment.status !== "paid" || !payment.paidAt) notFound();

  const rows: [string, string][] = [
    ["رقم الطلب", formatOrderNumber(payment.order.orderNumber)],
    ["المسار", payment.order.track.nameAr],
    ["العميل", payment.order.client.name],
    ["البريد الإلكتروني", payment.order.client.email],
    ["رقم الدفعة", String(payment.installmentNumber)],
    ["طريقة الدفع", payment.method ? (METHOD_LABEL[payment.method] ?? payment.method) : "—"],
    ["تاريخ السداد", new Date(payment.paidAt).toLocaleString("ar-SA", { dateStyle: "long", timeStyle: "short" })],
    ["المرجع", payment.gatewayReference ?? "—"],
  ];

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-10 print:py-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">إيصال سداد</h1>
          <p className="text-muted-foreground mt-1 text-sm">Leapin — منصة تراخيص وتأسيس الشركات</p>
        </div>
        <span className="text-muted-foreground font-mono text-sm">
          {formatOrderNumber(payment.order.orderNumber)}/{payment.installmentNumber}
        </span>
      </div>

      <dl className="divide-y rounded-lg border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 p-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-end">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 p-3 text-lg font-semibold">
          <dt>المبلغ المدفوع</dt>
          <dd>{Number(payment.amount).toLocaleString("ar-SA")} ريال</dd>
        </div>
      </dl>

      <p className="text-muted-foreground text-xs">
        السعر شامل الرسوم الحكومية. هذا الإيصال مُصدر آليًا ولا يحتاج توقيعًا.
      </p>

      {/* Hidden when printed — it is a screen control, not part of the receipt. */}
      <p className="text-muted-foreground text-xs print:hidden">
        لحفظ الإيصال كملف PDF، استخدم أمر الطباعة في المتصفح ثم اختر «حفظ كـ PDF».
      </p>
    </main>
  );
}
