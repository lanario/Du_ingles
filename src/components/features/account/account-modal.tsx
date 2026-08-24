"use client";

/**
 * Modal de "Perfil" aberto a partir do menu da conta na sidebar — substitui
 * as antigas páginas `/perfil` e `/admin/perfil`. Os dados vêm prontos do
 * layout (mesma query que já alimentava o menu), então não há fetch ao abrir.
 */

import Link from "next/link";
import type { Route } from "next";
import { Dialog } from "@/components/ui/dialog";
import { AvatarUploader } from "@/components/features/account/avatar-uploader";
import { ProfileForm } from "@/components/features/account/profile-form";
import {
  accountClasses,
  type AccountTheme,
} from "@/components/features/account/account-theme";
import { cn } from "@/lib/utils";
import type { MyProfile } from "@/repositories/users";

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  profile: MyProfile | null;
  avatarUrl: string | null;
  theme: AccountTheme;
  securityHref: Route;
}

export function AccountModal({
  open,
  onClose,
  profile,
  avatarUrl,
  theme,
  securityHref,
}: AccountModalProps) {
  const classes = accountClasses(theme);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Perfil"
      description="Sua foto e seus dados de contato."
      size="lg"
    >
      {profile ? (
        <div className="space-y-6">
          <AvatarUploader
            userId={profile.id}
            name={profile.fullName || profile.email}
            avatarUrl={avatarUrl}
            theme={theme}
          />
          <ProfileForm profile={profile} theme={theme} />

          <p className={classes.muted}>
            Senha e {theme === "admin" ? "acesso ficam" : "sessões ficam"} em{" "}
            <Link
              href={securityHref}
              onClick={onClose}
              className={cn(
                "font-medium underline",
                theme === "app" && "text-navy-900",
              )}
            >
              Segurança
            </Link>
            .
          </p>
        </div>
      ) : (
        <p className={classes.muted}>
          Não foi possível carregar seus dados. Recarregue a página.
        </p>
      )}
    </Dialog>
  );
}
