import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DeleteMixingRuleButton } from "@/components/superadmin/delete-mixing-rule-button";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function ActivityMixingRulesListPage() {
  await requirePageRole([UserRole.super_admin]);

  const rules = await prisma.activityMixingRule.findMany({
    include: { baseCategory: true, addableCategory: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">قواعد دمج الأنشطة</h1>
        <Button
          nativeButton={false}
          render={<Link href="/superadmin/activity-mixing-rules/new">+ إضافة قاعدة</Link>}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الفئة الأساسية</TableHead>
            <TableHead>الفئة المضافة</TableHead>
            <TableHead>مسموح</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell>{rule.baseCategory.nameAr}</TableCell>
              <TableCell>{rule.addableCategory.nameAr}</TableCell>
              <TableCell>
                <Badge variant={rule.isAllowed ? "default" : "outline"}>{rule.isAllowed ? "نعم" : "لا"}</Badge>
              </TableCell>
              <TableCell>
                <DeleteMixingRuleButton ruleId={rule.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
