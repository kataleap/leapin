import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function AdminProfilePage() {
  const session = await requirePageRole([UserRole.admin, UserRole.super_admin]);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">الملف الشخصي</h1>
      <ProfileForm
        role={user.role}
        pendingPhone={user.pendingPhone}
        initial={{
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
          nationality: "",
          addressCountry: "",
          addressCity: "",
          addressPostalCode: "",
        }}
      />
    </div>
  );
}
