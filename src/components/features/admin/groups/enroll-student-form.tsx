"use client";

/**
 * Matrículas da turma: o seletor de aluno em cima e a lista de matriculados
 * embaixo, na mesma linguagem visual dos cartões de aluno (avatar de iniciais,
 * linhas que entram e saem com `AnimatePresence`).
 *
 * O botão de remover confirma no próprio lugar — remover matrícula é a única
 * ação destrutiva desta tela, e um diálogo inteiro para isso seria mais
 * cerimônia do que a ação merece.
 */

import { useActionState, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { enrollStudentAction, unenrollStudentAction } from "@/actions/admin/groups";
import { Select } from "@/components/ui/select";
import { FormBanner } from "@/components/ui/form-message";
import { PlusIcon, SpinnerIcon, TrashIcon, UserIcon } from "@/components/ui/icons";
import { UserAvatar } from "@/components/features/admin/users/users-visuals";
import { CopyButton } from "./groups-visuals";
import { cn } from "@/lib/utils";
import type { EnrollmentListItem } from "@/repositories/enrollments";
import type { UserListItem } from "@/repositories/users";

export function EnrollStudentForm({
  groupId,
  enrollments,
  students,
  seatsLeft,
}: {
  groupId: string;
  enrollments: EnrollmentListItem[];
  students: UserListItem[];
  /** Vagas restantes — zero trava o seletor em vez de deixar o erro vir do servidor. */
  seatsLeft: number;
}) {
  const action = enrollStudentAction.bind(null, groupId);
  const [state, formAction, isPending] = useActionState(action, null);
  const [removing, startRemove] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const active = enrollments.filter((item) => item.status === "active");
  const enrolledIds = new Set(active.map((item) => item.studentId));
  const available = students.filter((student) => !enrolledIds.has(student.id));
  const full = seatsLeft <= 0;

  return (
    <div className="space-y-4">
      {state && !state.success && <FormBanner tone="error">{state.error.message}</FormBanner>}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label
            htmlFor="studentId"
            className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50"
          >
            Matricular aluno
          </label>
          <Select
            id="studentId"
            name="studentId"
            tone="admin"
            disabled={full || available.length === 0}
            defaultValue=""
            className="min-w-56"
            placeholder={
              full
                ? "Turma lotada"
                : available.length === 0
                  ? "Todos os alunos já estão matriculados"
                  : "Selecione…"
            }
          >
            {available.map((student) => (
              <option key={student.id} value={student.id}>
                {student.fullName}
              </option>
            ))}
          </Select>
        </div>

        <button
          type="submit"
          disabled={isPending || full || available.length === 0}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-4 text-sm font-semibold text-admin-foreground",
            "shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {isPending ? (
            <>
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              Matriculando…
            </>
          ) : (
            <>
              <PlusIcon className="h-4 w-4" />
              Matricular
            </>
          )}
        </button>
      </form>

      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-admin-border px-4 py-10 text-center text-sm text-admin-foreground/50">
          Nenhum aluno matriculado ainda.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-admin-border">
          <AnimatePresence initial={false} mode="popLayout">
            {active.map((enrollment) => (
              <motion.li
                key={enrollment.id}
                layout
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3 border-b border-admin-border bg-admin-surface px-3.5 py-3 text-sm transition-colors last:border-0 hover:bg-admin-muted/50"
              >
                <UserAvatar id={enrollment.studentId} name={enrollment.studentName} size="sm" />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-admin-foreground">
                    {enrollment.studentName}
                  </p>
                  <p className="truncate text-xs text-admin-foreground/50">
                    {enrollment.studentEmail}
                  </p>
                </div>

                {enrollment.studentEmail && (
                  <CopyButton
                    value={enrollment.studentEmail}
                    label={`Copiar e-mail de ${enrollment.studentName}`}
                  />
                )}

                {confirmId === enrollment.id ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() =>
                        startRemove(async () => {
                          await unenrollStudentAction(groupId, enrollment.id);
                          setConfirmId(null);
                        })
                      }
                      className="rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {removing ? "Removendo…" : "Confirmar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-lg border border-admin-border px-2.5 py-1.5 text-xs text-admin-foreground/60 transition-colors hover:bg-admin-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(enrollment.id)}
                    aria-label={`Remover ${enrollment.studentName} da turma`}
                    title="Remover da turma"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-admin-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {full && active.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-admin-foreground/50">
          <UserIcon className="h-3.5 w-3.5" />
          Turma lotada — aumente o máximo de alunos em &ldquo;Editar&rdquo; para matricular mais
          alguém.
        </p>
      )}
    </div>
  );
}
