import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export default async function PackagesListPage() {
  const packages = await prisma.package.findMany({
    include: { track: true, packageStages: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">الباقات</h1>
        <Button nativeButton={false} render={<Link href="/superadmin/packages/new">+ إضافة باقة</Link>} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الاسم</TableHead>
            <TableHead>المسار</TableHead>
            <TableHead>عدد المراحل</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packages.map((pkg) => (
            <TableRow key={pkg.id}>
              <TableCell>
                <Link href={`/superadmin/packages/${pkg.id}`} className="text-primary underline">
                  {pkg.nameAr}
                </Link>
              </TableCell>
              <TableCell>{pkg.track?.nameAr ?? "مستقلة عن المسار"}</TableCell>
              <TableCell>{pkg.packageStages.length}</TableCell>
              <TableCell>
                <Badge variant={pkg.isActive ? "default" : "outline"}>
                  {pkg.isActive ? "نشطة" : "غير نشطة"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
