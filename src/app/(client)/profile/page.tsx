import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ClientProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">الملف الشخصي</h1>
      <ProfileForm
        role={user.role}
        pendingPhone={user.pendingPhone}
        initial={{
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
          nationality: user.nationality ?? "",
          addressCountry: user.addressCountry ?? "",
          addressCity: user.addressCity ?? "",
          addressPostalCode: user.addressPostalCode ?? "",
        }}
      />
    </main>
  );
}
