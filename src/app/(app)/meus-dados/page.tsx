import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getMyProfile } from "@/repositories/users";
import { AvatarUploader } from "@/components/features/account/avatar-uploader";
import { ProfileForm } from "@/components/features/account/profile-form";
import { LgpdPanel } from "@/components/features/lgpd/lgpd-panel";

export const metadata: Metadata = { title: "Meu Perfil" };

export default async function MeuPerfilPage() {
  const ctx = await requireRole(["teacher", "student"]);
  const profile = await getMyProfile(ctx.userId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy-900">Meu Perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sua foto, seus dados pessoais e seus direitos como titular, conforme a LGPD.
      </p>
      {profile ? (
        <div className="mt-8 max-w-xl space-y-6">
          <AvatarUploader
            userId={profile.id}
            name={profile.fullName || profile.email}
            avatarUrl={ctx.avatarUrl}
          />
          <ProfileForm profile={profile} />
        </div>
      ) : null}
      <div className="mt-6">
        <LgpdPanel />
      </div>
    </div>
  );
}
