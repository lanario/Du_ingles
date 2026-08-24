"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  enrollStudentInMyGroupAction,
  transferStudentAction,
  unenrollFromMyGroupAction,
} from "@/actions/teacher/groups";
import { GroupCard } from "@/components/features/groups/group-card";
import { CreateGroupDialog } from "@/components/features/groups/create-group-dialog";
import { EditGroupDialog } from "@/components/features/groups/edit-group-dialog";
import {
  EnrollmentConflictDialog,
  type EnrollmentConflict,
} from "@/components/features/groups/enrollment-conflict-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FormBanner } from "@/components/ui/form-message";
import { ChevronIcon, PencilIcon, SwapIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { GroupDetail } from "@/repositories/groups";
import type { ActiveEnrollmentRef, EnrollmentListItem } from "@/repositories/enrollments";
import type { UserListItem } from "@/repositories/users";
import type { Course } from "@/repositories/courses";

interface TransferTarget {
  enrollmentId: string;
  fromGroupId: string;
  studentName: string;
}

function GroupRoster({
  group,
  roster,
  students,
  activeByStudent,
  onTransfer,
}: {
  group: GroupDetail;
  roster: EnrollmentListItem[];
  students: UserListItem[];
  activeByStudent: Record<string, ActiveEnrollmentRef>;
  onTransfer: (target: TransferTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isRemoving, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<EnrollmentConflict | null>(null);
  const [isPending, startEnroll] = useTransition();
  const reduceMotion = useReducedMotion();

  const active = roster.filter((entry) => entry.status === "active");
  const enrolledIds = new Set(active.map((entry) => entry.studentId));
  const available = students.filter((student) => !enrolledIds.has(student.id));
  const isFull = active.length >= group.maxStudents;

  function enroll(studentId: string, transfer: boolean) {
    startEnroll(async () => {
      const result = await enrollStudentInMyGroupAction(group.id, studentId, { transfer });
      setConflict(null);
      if (!result.success) {
        setEnrollError(result.error.message);
        return;
      }
      setEnrollError(null);
      setSelected("");
    });
  }

  /**
   * Um aluno pertence a uma turma só: se ele já tem outra, adicionar aqui é
   * transferir, e isso passa pelo aviso antes de virar chamada.
   */
  function submitEnroll() {
    if (!selected) return;
    setEnrollError(null);

    const current = activeByStudent[selected];
    if (current && current.groupId !== group.id) {
      setConflict({
        studentName: students.find((item) => item.id === selected)?.fullName ?? "Este aluno",
        fromGroupName: current.groupName,
        toGroupName: group.name,
      });
      return;
    }

    enroll(selected, false);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between rounded-lg text-sm font-medium text-navy-800 transition-colors hover:text-navy-600"
      >
        <span>Alunos ({active.length})</span>
        <ChevronIcon
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {removeError || enrollError ? (
                <FormBanner tone="error">{removeError ?? enrollError}</FormBanner>
              ) : null}

              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum aluno matriculado ainda.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {active.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {entry.studentName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.studentEmail}
                        </p>
                      </div>
                      <div className="flex flex-none items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onTransfer({
                              enrollmentId: entry.id,
                              fromGroupId: group.id,
                              studentName: entry.studentName,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-navy-700 transition-colors hover:bg-muted"
                        >
                          <SwapIcon className="h-3.5 w-3.5" />
                          Transferir
                        </button>
                        <button
                          type="button"
                          disabled={isRemoving}
                          onClick={() =>
                            startRemove(async () => {
                              setRemoveError(null);
                              const result = await unenrollFromMyGroupAction(
                                group.id,
                                entry.id,
                              );
                              if (!result.success) setRemoveError(result.error.message);
                            })
                          }
                          className="rounded-md px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          Remover
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor={`enroll-${group.id}`} className="text-xs">
                    Adicionar aluno
                  </Label>
                  <Select
                    id={`enroll-${group.id}`}
                    value={selected}
                    onChange={setSelected}
                  >
                    <option value="">Selecione…</option>
                    {available.map((student) => {
                      const current = activeByStudent[student.id];
                      return (
                        <option key={student.id} value={student.id}>
                          {student.fullName}
                          {current && current.groupId !== group.id
                            ? ` · em ${current.groupName}`
                            : ""}
                        </option>
                      );
                    })}
                  </Select>
                </div>
                <Button
                  type="button"
                  onClick={submitEnroll}
                  disabled={isPending || isFull || available.length === 0 || !selected}
                  title={isFull ? "Turma lotada" : undefined}
                >
                  {isPending ? "Adicionando…" : "Adicionar"}
                </Button>
              </div>

              <EnrollmentConflictDialog
                conflict={conflict}
                tone="app"
                busy={isPending}
                onConfirm={() => enroll(selected, true)}
                onCancel={() => setConflict(null)}
              />
              {isFull && (
                <p className="text-xs text-warning">
                  Turma lotada — aumente o limite para matricular mais alunos.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TransferDialog({
  target,
  groups,
  onClose,
}: {
  target: TransferTarget | null;
  groups: GroupDetail[];
  onClose: () => void;
}) {
  const action = transferStudentAction.bind(null, target?.fromGroupId ?? "");
  const [state, formAction, isPending] = useActionState(action, null);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const options = groups.filter(
    (group) => group.id !== target?.fromGroupId && group.isActive,
  );

  return (
    <Dialog
      open={Boolean(target)}
      onClose={onClose}
      title="Transferir aluno"
      description={
        target ? `${target.studentName} passará a frequentar a nova turma.` : undefined
      }
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="enrollmentId" value={target?.enrollmentId ?? ""} />

        {state && !state.success && (
          <FormBanner tone="error">{state.error.message}</FormBanner>
        )}

        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você não tem outra turma ativa para onde transferir.
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="transfer-target">Turma de destino</Label>
            <Select id="transfer-target" name="toGroupId" defaultValue="">
              <option value="">Selecione…</option>
              {options.map((group) => (
                <option
                  key={group.id}
                  value={group.id}
                  disabled={group.enrolledCount >= group.maxStudents}
                >
                  {group.name} · {group.level} ({group.enrolledCount}/{group.maxStudents})
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending || options.length === 0}>
            {isPending ? "Transferindo…" : "Transferir"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function TeacherGroups({
  groups,
  rosters,
  students,
  activeByStudent,
  courses,
  teachers,
}: {
  groups: GroupDetail[];
  rosters: Record<string, EnrollmentListItem[]>;
  students: UserListItem[];
  /**
   * Turma atual de cada aluno da escola — inclusive as de outros professores,
   * que não aparecem em `rosters`. É daqui que sai o aviso de "já tem turma".
   */
  activeByStudent: Record<string, ActiveEnrollmentRef>;
  courses: Course[];
  /**
   * Só o admin recebe essa lista. A presença dela é o que liga o modo
   * "gestão total" — escolher/reatribuir professor nos diálogos de criar e
   * editar — sem precisar de uma prop `isAdmin` redundante.
   */
  teachers?: UserListItem[];
}) {
  const [target, setTarget] = useState<TransferTarget | null>(null);
  const [editing, setEditing] = useState<GroupDetail | null>(null);
  const isAdminView = Boolean(teachers);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Turmas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdminView
              ? "Crie, edite e gerencie as turmas de toda a escola."
              : "Crie turmas, matricule alunos e mova quem precisar trocar de horário."}
          </p>
        </div>
        <CreateGroupDialog courses={courses} teachers={teachers} />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
          <p className="font-medium text-navy-900">
            {isAdminView ? "Nenhuma turma criada ainda." : "Você ainda não tem turmas."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie a primeira e as sessões das próximas 4 semanas entram na agenda.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group, index) => (
            <GroupCard
              key={group.id}
              group={group}
              index={index}
              headerAction={
                <button
                  type="button"
                  onClick={() => setEditing(group)}
                  aria-label={`Editar ${group.name}`}
                  className="flex-none rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-navy-800"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              }
            >
              <GroupRoster
                group={group}
                roster={rosters[group.id] ?? []}
                students={students}
                activeByStudent={activeByStudent}
                onTransfer={setTarget}
              />
            </GroupCard>
          ))}
        </div>
      )}

      <TransferDialog
        // Remonta a cada aluno: o `useActionState` interno precisa começar
        // limpo, senão o erro da transferência anterior aparece na próxima.
        key={target?.enrollmentId ?? "none"}
        target={target}
        groups={groups}
        onClose={() => setTarget(null)}
      />

      <EditGroupDialog
        key={editing?.id ?? "none"}
        group={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        courses={courses}
        teachers={teachers}
      />
    </div>
  );
}
