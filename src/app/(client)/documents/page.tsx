import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  misa_license: "ترخيص وزارة الاستثمار",
  commercial_register: "السجل التجاري",
  incorporation_contract: "عقد التأسيس",
  foreign_company_docs: "مستندات الشركة الأجنبية",
  financial_statements: "القوائم المالية",
  other: "أخرى",
};

export default async function ClientDocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const documents = await prisma.documentVault.findMany({
    where: { isVisibleToClient: true, order: { clientId: session.user.id } },
    include: { order: { include: { track: true } } },
    orderBy: { uploadedAt: "desc" },
  });

  const grouped = documents.reduce<Record<string, typeof documents>>((acc, doc) => {
    (acc[doc.documentType] ??= []).push(doc);
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">مستنداتي</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          المستندات التي رفعها فريقنا لك، عبر جميع طلباتك.
        </p>
      </div>

      {documents.length === 0 ? (
        <p className="text-muted-foreground text-sm">لا توجد مستندات متاحة لك حاليًا.</p>
      ) : (
        Object.entries(grouped).map(([documentType, docs]) => (
          <Card key={documentType}>
            <CardHeader>
              <CardTitle>{DOCUMENT_TYPE_LABEL[documentType] ?? documentType}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between text-sm">
                    <a
                      href={`/api/documents/${doc.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      {doc.originalFileName}
                    </a>
                    <span className="text-muted-foreground flex items-center gap-2">
                      <span>{doc.order.track.nameAr}</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString("ar-SA")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </main>
  );
}
