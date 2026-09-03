import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export default async function ActivityCategoriesListPage() {
  const categories = await prisma.activityCategory.findMany({
    include: { track: true },
    orderBy: { nameAr: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">الفئات النشاطية</h1>
        <Button nativeButton={false} render={<Link href="/superadmin/activity-categories/new">+ إضافة فئة</Link>} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الرمز</TableHead>
            <TableHead>الاسم</TableHead>
            <TableHead>المسار</TableHead>
            <TableHead>الشركات الأجنبية</TableHead>
            <TableHead>الحد الأدنى لرأس المال</TableHead>
            <TableHead>ريادة الأعمال</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell>
                <Link href={`/superadmin/activity-categories/${category.id}`} className="text-primary underline">
                  {category.code}
                </Link>
              </TableCell>
              <TableCell>{category.nameAr}</TableCell>
              <TableCell>{category.track.nameAr}</TableCell>
              <TableCell>{category.minForeignCompanies ?? "—"}</TableCell>
              <TableCell>
                {category.minCapitalSar ? Number(category.minCapitalSar).toLocaleString("ar-SA") : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={category.allowedInEntrepreneurship ? "default" : "outline"}>
                  {category.allowedInEntrepreneurship ? "نعم" : "لا"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={category.status === "active" ? "default" : "outline"}>{category.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
