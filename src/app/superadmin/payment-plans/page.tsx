import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function PaymentPlansListPage() {
  await requirePageRole([UserRole.super_admin]);

  const plans = await prisma.paymentPlan.findMany({
    include: { installments: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">خطط الدفع</h1>
        <Button
          nativeButton={false}
          render={<Link href="/superadmin/payment-plans/new">+ إضافة خطة</Link>}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الرمز</TableHead>
            <TableHead>النوع</TableHead>
            <TableHead>عدد الدفعات</TableHead>
            <TableHead>افتراضية</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell>
                <Link href={`/superadmin/payment-plans/${plan.id}`} className="text-primary underline">
                  {plan.code}
                </Link>
              </TableCell>
              <TableCell>{plan.ownerType === "package" ? "باقة" : "طلب"}</TableCell>
              <TableCell>{plan.installments.length}</TableCell>
              <TableCell>
                <Badge variant={plan.isDefault ? "default" : "outline"}>{plan.isDefault ? "نعم" : "لا"}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
