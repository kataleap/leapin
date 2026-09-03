import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/superadmin/user-form";

type Params = { params: Promise<{ id: string }> };

export default async function EditUserPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">تعديل مستخدم: {user.name}</h1>
      <UserForm mode="edit" userId={user.id} isSelf={user.id === session.user.id} initial={user} />
    </div>
  );
}
