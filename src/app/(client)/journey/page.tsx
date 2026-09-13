import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { JourneyWizard } from "@/components/client/journey-wizard";
import { nationalityLabel } from "@/lib/reference/nationalities";
import { missingProfileFields, PROFILE_FIELD_LABEL } from "@/lib/orders/journey-readiness";
import { isNonObjectionLetterRequired } from "@/lib/orders/non-objection";

// The journey now starts on the server, for two reasons.
//
// First, it used to render for anyone: the page returned 200 to a signed-out
// visitor while every fetch inside it answered 401, leaving a skeleton
// spinning forever with no message and no way to sign in.
//
// Second, the journey's later steps depend on facts about the client that the
// account did not collect — nationality decides which formation countries may
// be offered at all (doc §5.1, country_nationality_restrictions), so asking
// for it here, before step 1, is what makes the country step answerable
// instead of arbitrary.
export default async function JourneyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Staff have no journey of their own — the wizard creates an order owned by
  // the signed-in user, which only makes sense for a client.
  if (session.user.role !== UserRole.client) redirect("/admin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nationality: true, residencyStatus: true, phone: true },
  });
  if (!user) redirect("/login");

  const missing = missingProfileFields(user);

  if (missing.length > 0) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold">ابدأ رحلتك</h1>
          <p className="text-muted-foreground mt-1 text-sm">خطوة واحدة قبل أن نبدأ.</p>
        </div>
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>أكمل بيانات حسابك أولًا</CardTitle>
            <CardDescription>
              نحتاج هذه البيانات لتحديد الخيارات المتاحة لك بدقة — لا لتعبئة النماذج.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {missing.map((field) => (
                <li key={field} className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span>
                    <span className="font-medium">{PROFILE_FIELD_LABEL[field].label}</span>
                    <span className="text-muted-foreground block text-xs">
                      {PROFILE_FIELD_LABEL[field].why}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Button nativeButton={false} render={<Link href="/profile">إكمال البيانات</Link>} />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">ابدأ رحلتك</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          اختر المسار ثم الباقة المناسبة، وشاهد السعر فورًا.
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          الجنسية المسجَّلة: {nationalityLabel(user.nationality)} — تُحدَّد الدول المتاحة بناءً عليها.{" "}
          <Link href="/profile" className="text-primary underline">
            تعديل
          </Link>
        </p>
      </div>
      {isNonObjectionLetterRequired(user) && (
        <Card>
          <CardHeader>
            <CardTitle>ستحتاج خطاب عدم ممانعة</CardTitle>
            <CardDescription>
              بصفتك مقيمًا في السعودية، يلزم خطاب من صاحب العمل (الكفيل) يفيد بعدم ممانعته تأسيسك
              للشركة. يمكنك البدء الآن ورفع الخطاب لاحقًا من صفحة طلبك — نذكرك به هنا حتى تطلبه من
              جهة عملك مبكرًا.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <JourneyWizard />
    </main>
  );
}
