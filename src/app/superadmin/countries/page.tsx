import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function CountriesListPage() {
  await requirePageRole([UserRole.super_admin]);

  const countries = await prisma.country.findMany({ orderBy: { nameAr: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">الدول</h1>
        <Button nativeButton={false} render={<Link href="/superadmin/countries/new">+ إضافة دولة</Link>} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الاسم</TableHead>
            <TableHead>السعر</TableHead>
            <TableHead>المدة (أيام)</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {countries.map((country) => (
            <TableRow key={country.id}>
              <TableCell>
                <Link href={`/superadmin/countries/${country.id}`} className="text-primary underline">
                  {country.nameAr}
                </Link>
              </TableCell>
              <TableCell>{Number(country.basePrice).toLocaleString("ar-SA")} ريال</TableCell>
              <TableCell>
                {country.durationMinDays}–{country.durationMaxDays}
              </TableCell>
              <TableCell>
                <Badge variant={country.status === "active" ? "default" : "outline"}>{country.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
