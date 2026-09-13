import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { sessionHasAccountingAccess } from "@/lib/auth/accounting";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT } from "@/lib/orders/status-labels";
import { AccountingConfirmButton } from "@/components/admin/accounting-confirm-button";
import { formatOrderNumber } from "@/lib/orders/order-number";
import {
  INSTALLMENT_FILTERS,
  INSTALLMENT_FILTER_LABEL,
  buildInstallmentWhere,
  isAwaitingManualReview,
  matchesInstallmentFilter,
  parseInstallmentFilter,
  type InstallmentFilter,
} from "@/lib/payments/installment-view";

// Session-dependent and permission-gated: never let this be cached and
// replayed to a different admin.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "معلّقة",
  paid: "مدفوعة",
  failed: "فشلت",
  refunded: "مُستردة",
};

const METHOD_LABEL: Record<string, string> = {
  online: "الكتروني",
  bank_transfer: "تحويل بنكي",
  cash: "كاش",
};

function buildHref(filter: InstallmentFilter, page: number) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/accounting?${query}` : "/admin/accounting";
}

export default async function AccountingPage({ searchParams }: PageProps<"/admin/accounting">) {
  const session = await requirePageRole([UserRole.admin, UserRole.super_admin]);

  // §5.1 — the flag, not the role, is what opens this section. A super admin
  // without it does not get in either; they grant it to themselves from the
  // user panel like anyone else. notFound() rather than a 403 page, matching
  // how an unassigned order already hides itself from an admin.
  if (!(await sessionHasAccountingAccess(session))) notFound();

  const sp = await searchParams;
  const filter = parseInstallmentFilter(sp.status);
  const rawPage = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isInteger(rawPage) && rawPage > 1 ? rawPage : 1;

  const installmentWhere = buildInstallmentWhere(filter);
  // §4 — no assignment predicate anywhere in this query. That absence is the
  // whole feature: every order, every client, regardless of which admin holds
  // the stages.
  const where = installmentWhere ? { orderPayments: { some: installmentWhere } } : {};

  const [total, orders, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPrice: true,
        createdAt: true,
        client: { select: { name: true, email: true } },
        paymentPlan: { select: { code: true, installmentsCount: true } },
        orderPayments: {
          select: {
            id: true,
            installmentNumber: true,
            amount: true,
            status: true,
            method: true,
            dueAt: true,
            proofUploadedAt: true,
            gatewayReference: true,
          },
          orderBy: { installmentNumber: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    Promise.all(
      INSTALLMENT_FILTERS.map(async (f) => {
        const w = buildInstallmentWhere(f);
        return prisma.order.count({ where: w ? { orderPayments: { some: w } } : {} });
      })
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">المحاسبة</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          الدفعات والعقود عبر كل عملاء المنصة. الإجراء المتاح هنا هو تأكيد الدفعات اليدوية فقط.
        </p>
      </div>

      {/* §5.3 — تصفية حسب حالة الدفعة */}
      <div className="flex flex-wrap gap-2 border-b pb-4 text-sm">
        {INSTALLMENT_FILTERS.map((f, i) => (
          <Link
            key={f}
            href={buildHref(f, 1)}
            className={
              f === filter
                ? "bg-primary text-primary-foreground rounded-lg px-3 py-1.5"
                : "text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5"
            }
          >
            {INSTALLMENT_FILTER_LABEL[f]} ({counts[i].toLocaleString("ar-SA")})
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">لا توجد طلبات مطابقة لهذا الفلتر.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الطلب</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>قيمة الطلب</TableHead>
              <TableHead>خطة الدفع</TableHead>
              <TableHead>الأقساط</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="align-top">
                  {/* §5.5 — نفس صفحة تفاصيل الطلب المستخدمة من لوحة الأدمن */}
                  <Link href={`/admin/orders/${order.id}`} className="text-primary underline">
                    {formatOrderNumber(order.orderNumber)}
                  </Link>
                  <div className="mt-1">
                    <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
                      {ORDER_STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div>{order.client.name}</div>
                  <div className="text-muted-foreground text-xs">{order.client.email}</div>
                </TableCell>
                <TableCell className="align-top whitespace-nowrap">
                  {Number(order.totalPrice).toLocaleString("ar-SA")} ريال
                </TableCell>
                <TableCell className="align-top">
                  {order.paymentPlan ? (
                    <>
                      <div>{order.paymentPlan.code}</div>
                      <div className="text-muted-foreground text-xs">
                        {order.paymentPlan.installmentsCount} أقساط
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <div className="space-y-2">
                    {order.orderPayments.map((p) => {
                      const awaiting = isAwaitingManualReview(p);
                      // Highlight the installments the active filter actually
                      // matched, so a row that appears under "awaiting review"
                      // says which of its four installments put it there.
                      const matched = filter !== "all" && matchesInstallmentFilter(p, filter);
                      // §4 — الدفعات الإلكترونية مستثناة تمامًا. An installment
                      // with a gateway invoice against it is Moyasar's to
                      // settle; the API refuses it for this permission too.
                      const manual = !p.gatewayReference && p.method !== "online";
                      const confirmable = p.dueAt != null && p.status === "pending" && manual;
                      return (
                        <div
                          key={p.id}
                          className={`rounded-lg border p-2 text-xs ${matched ? "border-primary" : ""}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              قسط {p.installmentNumber} — {Number(p.amount).toLocaleString("ar-SA")} ريال
                            </span>
                            <Badge
                              variant={
                                p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "outline"
                              }
                            >
                              {p.status === "pending" && !p.dueAt
                                ? "غير مستحقة بعد"
                                : awaiting
                                  ? "بانتظار مراجعة يدوية"
                                  : (PAYMENT_STATUS_LABEL[p.status] ?? p.status)}
                            </Badge>
                            {p.method && (
                              <span className="text-muted-foreground">{METHOD_LABEL[p.method] ?? p.method}</span>
                            )}
                          </div>
                          {confirmable && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {awaiting && (
                                <Link
                                  href={`/api/orders/${order.id}/payments/${p.installmentNumber}/proof`}
                                  className="text-primary underline"
                                  target="_blank"
                                >
                                  عرض الإيصال
                                </Link>
                              )}
                              {awaiting && <AccountingConfirmButton paymentId={p.id} method="bank_transfer" />}
                              <AccountingConfirmButton paymentId={p.id} method="cash" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            صفحة {page.toLocaleString("ar-SA")} من {totalPages.toLocaleString("ar-SA")}
          </span>
          <div className="flex gap-4">
            {page > 1 && (
              <Link href={buildHref(filter, page - 1)} className="text-primary underline">
                السابق
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildHref(filter, page + 1)} className="text-primary underline">
                التالي
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
