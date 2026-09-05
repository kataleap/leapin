import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export default async function StagesListPage() {
  await requirePageRole([UserRole.super_admin]);

  const stages = await prisma.stage.findMany({ orderBy: { sequenceOrder: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">المراحل</h1>
        <Button nativeButton={false} render={<Link href="/superadmin/stages/new">+ إضافة مرحلة</Link>} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الرمز</TableHead>
            <TableHead>الاسم</TableHead>
            <TableHead>النطاق</TableHead>
            <TableHead>الترتيب</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages.map((stage) => (
            <TableRow key={stage.id}>
              <TableCell>{stage.code}</TableCell>
              <TableCell>
                <Link href={`/superadmin/stages/${stage.id}`} className="text-primary underline">
                  {stage.nameAr}
                </Link>
              </TableCell>
              <TableCell>{stage.trackScope}</TableCell>
              <TableCell>{stage.sequenceOrder}</TableCell>
              <TableCell>
                <Badge variant={stage.status === "active" ? "default" : "outline"}>{stage.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
