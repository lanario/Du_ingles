"use client";

/**
 * Painel de detalhe de um aluno — o que abre quando se clica no cartão.
 * Reaproveita os componentes de ação já conectados às server actions em
 * `admin/users` (trocar dados, ativar/desativar, excluir, "ver como") e
 * acrescenta o que é específico do aluno: turma atual e responsável.
 *
 * A turma vem de `Student` (já resolvida em memória pela página) e não de
 * `UserDetail` — só a página de Usuários usa a ficha completa por inteiro;
 * aqui ela serve principalmente para os campos de contato e o formulário.
 */

import { motion, useReducedMotion } from "framer-motion";
import { CalendarIcon, MailIcon, SwapIcon, UserIcon } from "@/components/ui/icons";
import { SidePanel } from "@/components/ui/side-panel";
import {
  DetailBody,
  DetailButton,
  DetailHeader,
  DetailRow,
  DetailSection,
} from "@/components/ui/detail-panel";
import { EditUserForm } from "@/components/features/admin/users/edit-user-form";
import { UserLifecycleActions } from "@/components/features/admin/users/user-lifecycle-actions";
import { SetPasswordForm } from "@/components/features/admin/users/set-password-form";
import { CopyButton, GroupPill, LevelPill, PendingPasswordPill, StatusPill, UserAvatar } from "./students-visuals";
import { formatDate, type Student } from "./students-utils";
import type { UserDetail as UserDetailData } from "@/repositories/users";

interface StudentDetailProps {
  open: boolean;
  onClose: () => void;
  user: UserDetailData | null;
  student: Student | null;
  /** Muda a cada abertura; remonta o conteúdo para as animações rodarem de novo. */
  session: number;
  onMove: () => void;
  /**
   * Sem gestão (área do professor), o painel é uma ficha de consulta: some o
   * ciclo de vida da conta, a troca de senha, a edição cadastral e o botão de
   * mover de turma — tudo isso é coordenação.
   */
  canManage?: boolean;
}

export function StudentDetail({
  open,
  onClose,
  user,
  student,
  session,
  onMove,
  canManage = true,
}: StudentDetailProps) {
  return (
    <SidePanel open={open} onClose={onClose} title={user?.fullName ?? "Aluno"} subtitle={user?.email} wide>
      {user && student && (
        <StudentDetailContent
          key={session}
          user={user}
          student={student}
          onMove={onMove}
          canManage={canManage}
        />
      )}
    </SidePanel>
  );
}

function StudentDetailContent({
  user,
  student,
  onMove,
  canManage,
}: {
  user: UserDetailData;
  student: Student;
  onMove: () => void;
  canManage: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const guardianEmail = user.studentProfile?.guardianEmail ?? null;
  const guardianPhone = user.studentProfile?.guardianPhone ?? null;
  const hasGuardian = Boolean(student.guardianName || guardianEmail || guardianPhone);

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
          description="Aluno"
          badges={
            <>
              <StatusPill isActive={user.isActive} />
              <LevelPill level={student.currentLevel} />
              {user.mustChangePassword && <PendingPasswordPill />}
            </>
          }
        />

        {canManage && (
          <DetailSection title="Ações">
            <UserLifecycleActions user={user} />
          </DetailSection>
        )}

        <DetailSection title="Turma">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-admin-border px-3.5 py-3">
            <GroupPill name={student.groupName} level={student.groupLevel} />
            {canManage && (
              <DetailButton icon={SwapIcon} label="Mover" tone="accent" onClick={onMove} />
            )}
          </div>
        </DetailSection>

        {hasGuardian && (
          <DetailSection title="Responsável">
            <div className="rounded-xl border border-admin-border px-3.5">
              <DetailRow icon={UserIcon} label="Nome" value={student.guardianName} />
              <DetailRow
                icon={MailIcon}
                label="E-mail"
                value={guardianEmail}
                href={guardianEmail ? `mailto:${guardianEmail}` : undefined}
              />
              <DetailRow icon={UserIcon} label="Telefone" value={guardianPhone} />
            </div>
          </DetailSection>
        )}

        {canManage && user.role !== "admin" && (
          <DetailSection title="Senha">
            <SetPasswordForm userId={user.id} userName={user.fullName.split(" ")[0] ?? "o aluno"} />
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
            <DetailRow icon={CalendarIcon} label="Aluno desde" value={formatDate(user.createdAt)} />
          </div>
        </DetailSection>

        {canManage && (
          <DetailSection title="Dados cadastrais">
            <EditUserForm user={user} />
          </DetailSection>
        )}
      </DetailBody>
    </motion.div>
  );
}
