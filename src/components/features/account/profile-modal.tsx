"use client";

/**
 * Modal de "Meu Perfil" aberto a partir do menu da conta — substitui as
 * antigas páginas `/meus-dados`, `/admin/meus-dados` e `/professor/meus-dados`
 * como destino de navegação (mesmo padrão do `SecurityModal`, que já tinha
 * saído de página própria para modal).
 */

import { Dialog } from "@/components/ui/dialog";
import { AvatarUploader } from "@/components/features/account/avatar-uploader";
import { ProfileForm } from "@/components/features/account/profile-form";
import { PerformancePanel } from "@/components/features/account/performance-panel";
import { LgpdPanel } from "@/components/features/lgpd/lgpd-panel";
import type { AccountTheme } from "@/components/features/account/account-theme";
import type { MyProfile } from "@/repositories/users";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  theme: AccountTheme;
  profile: MyProfile | null;
  avatarUrl: string | null;
}

export function ProfileModal({ open, onClose, theme, profile, avatarUrl }: ProfileModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Meu Perfil"
      description="Sua foto, seus dados pessoais e seus direitos como titular, conforme a LGPD."
      size="lg"
    >
      {profile && (
        <div className="space-y-6">
          <AvatarUploader
            userId={profile.id}
            name={profile.fullName || profile.email}
            avatarUrl={avatarUrl}
            theme={theme}
          />
          <ProfileForm profile={profile} theme={theme} />
          <PerformancePanel theme={theme} />
          <LgpdPanel theme={theme} />
        </div>
      )}
    </Dialog>
  );
}
