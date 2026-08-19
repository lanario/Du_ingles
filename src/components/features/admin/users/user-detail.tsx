"use client";

/**
 * Painel de detalhe de um usuário — o que abre quando se clica no cartão.
 * Junta identidade, contato e as ações que já existiam na ficha completa
 * (`/admin/usuarios/[id]`): trocar papel, editar dados, ativar/desativar,
 * excluir e "ver como".
 *
 * As ações continuam sendo os mesmos componentes conectados às server
 * actions — o painel só lhes dá uma casa consistente com o resto do painel
 * administrativo, sem duplicar lógica de permissão nem de auditoria.
 */

import { motion, useReducedMotion } from "framer-motion";
import { CalendarIcon, MailIcon, UserIcon } from "@/components/ui/icons";
import { SidePanel } from "@/components/ui/side-panel";
import { DetailBody, DetailHeader, DetailRow, DetailSection } from "@/components/ui/detail-panel";
import { ChangeRoleForm } from "./change-role-form";
import { EditUserForm } from "./edit-user-form";
import { SetPasswordForm } from "./set-password-form";
import { UserLifecycleActions } from "./user-lifecycle-actions";
import { PendingPasswordPill, RolePill, StatusPill, UserAvatar, CopyButton } from "./users-visuals";
import { formatDate } from "./users-utils";
import type { UserDetail as UserDetailData } from "@/repositories/users";

interface UserDetailProps {
  open: boolean;
  onClose: () => void;
  user: UserDetailData | null;
  /** Muda a cada abertura; remonta o conteúdo para as animações rodarem de novo. */
  session: number;
}

export function UserDetail({ open, onClose, user, session }: UserDetailProps) {
  return (
    <SidePanel open={open} onClose={onClose} title={user?.fullName ?? "Usuário"} subtitle={user?.email} wide>
      {user && <UserDetailContent key={session} user={user} />}
    </SidePanel>
  );
}

function UserDetailContent({ user }: { user: UserDetailData }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <DetailBody>
        <DetailHeader
          avatar={<UserAvatar id={user.id} name={user.fullName} />}
          title={user.fullName}
          description={
            user.role === "teacher"
              ? "Professor"
              : user.role === "student"
                ? "Aluno"
                : "Administrador"
          }
          badges={
            <>
              <StatusPill isActive={user.isActive} />
              <RolePill role={user.role} />
              {user.mustChangePassword && <PendingPasswordPill />}
            </>
          }
        />

        <DetailSection title="Ações">
          <UserLifecycleActions user={user} />
        </DetailSection>

        <DetailSection title="Papel">
          <ChangeRoleForm userId={user.id} currentRole={user.role} />
        </DetailSection>

        {user.role !== "admin" && (
          <DetailSection title="Senha">
            <SetPasswordForm userId={user.id} userName={user.fullName.split(" ")[0] ?? "o usuário"} />
          </DetailSection>
        )}

        <DetailSection title="Contato">
          <div className="rounded-xl border border-admin-border px-3.5">
            <DetailRow
              icon={MailIcon}
              label="E-mail"
              value={user.email}
              href={`mailto:${user.email}`}
              action={<CopyButton value={user.email} label={`Copiar e-mail de ${user.fullName}`} />}
            />
            <DetailRow icon={UserIcon} label="Telefone" value={user.phone} />
            <DetailRow
              icon={CalendarIcon}
              label="Cadastrado em"
              value={formatDate(user.createdAt)}
            />
          </div>
        </DetailSection>

        <DetailSection title="Dados cadastrais">
          <EditUserForm user={user} />
        </DetailSection>
      </DetailBody>
    </motion.div>
  );
}
