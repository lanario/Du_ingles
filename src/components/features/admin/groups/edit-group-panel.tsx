"use client";

/**
 * Edição de turma — mesmo painel e mesma gramática visual do `CreateGroupPanel`,
 * com os campos já preenchidos.
 *
 * Duas diferenças de fluxo importam:
 *
 * 1. A grade de horários só entra no `FormData` se o admin abrir o bloco. Sem
 *    isso, `updateGroup` não regera as sessões — e sessões já ligadas a planos
 *    de aula e presenças continuam de pé (ver `updateGroupSchema`).
 * 2. Não há redirect: `updateGroupAction` volta um `ActionResult`, então o
 *    fechamento e o `router.refresh()` acontecem aqui.
 */

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateGroupAction } from "@/actions/admin/groups";
import { SidePanel } from "@/components/ui/side-panel";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { ScheduleBuilder } from "@/components/features/admin/groups/schedule-builder";
import { CalendarIcon, PencilIcon, SpinnerIcon } from "@/components/ui/icons";
import { CEFR_LEVELS } from "@/types/domain";
import { cn } from "@/lib/utils";
import { scheduleSummary, type Group } from "./groups-utils";
import type { Course } from "@/repositories/courses";
import type { UserListItem } from "@/repositories/users";

const LEVEL_HINT: Record<string, string> = {
  A1: "Iniciante",
  A2: "Básico",
  B1: "Intermediário",
  B2: "Intermediário superior",
  C1: "Avançado",
  C2: "Proficiente",
};

export function EditGroupPanel({
  open,
  onClose,
  group,
  courses,
  teachers,
}: {
  open: boolean;
  onClose: () => void;
  group: Group | null;
  courses: Course[];
  teachers: UserListItem[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateGroupAction, null);
  const [level, setLevel] = useState<string>(group?.level ?? CEFR_LEVELS[0] ?? "A1");
  const [editSchedule, setEditSchedule] = useState(false);

  // Reabrir o painel em outra turma tem que recomeçar do zero — nível e o
  // estado do bloco de horários são locais, não vêm do servidor.
  useEffect(() => {
    if (!open || !group) return;
    setLevel(group.level);
    setEditSchedule(false);
  }, [open, group]);

  useEffect(() => {
    if (state?.success) {
      onClose();
      router.refresh();
    }
    // `onClose` muda a cada render do pai; observar só o resultado da ação
    // evita fechar o painel por re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fields = state && !state.success ? state.error.fields : undefined;

  return (
    <SidePanel
      open={open && group !== null}
      onClose={onClose}
      title="Editar turma"
      subtitle={group?.name}
      wide
    >
      {group && (
        <form key={group.id} action={formAction} className="flex min-h-full flex-col" noValidate>
          <input type="hidden" name="id" value={group.id} />
          <input type="hidden" name="level" value={level} />

          <div className="flex-1 space-y-5 px-4 py-5 sm:px-6">
            {state && !state.success && !state.error.fields && (
              <FormBanner tone="error">{state.error.message}</FormBanner>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-group-name" className="text-admin-foreground">
                Nome da turma <span className="text-gold-600">*</span>
              </Label>
              <Input
                id="edit-group-name"
                name="name"
                defaultValue={group.name}
                autoComplete="off"
                required
                className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
              />
              <FieldError messages={fields?.["name"]} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-group-teacherId" className="text-admin-foreground">
                  Professor <span className="text-gold-600">*</span>
                </Label>
                <Select
                  id="edit-group-teacherId"
                  name="teacherId"
                  tone="admin"
                  required
                  defaultValue={group.teacherId}
                >
                  {teachers.every((teacher) => teacher.id !== group.teacherId) && (
                    <option value={group.teacherId}>{group.teacherName}</option>
                  )}
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.fullName}
                    </option>
                  ))}
                </Select>
                <FieldError messages={fields?.["teacherId"]} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-group-courseId" className="text-admin-foreground">
                  Curso
                </Label>
                <Select
                  id="edit-group-courseId"
                  name="courseId"
                  tone="admin"
                  defaultValue={group.courseId ?? ""}
                >
                  <option value="">Nenhum</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-admin-foreground">Nível (CEFR)</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {CEFR_LEVELS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLevel(item)}
                    aria-pressed={level === item}
                    title={LEVEL_HINT[item]}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                      level === item
                        ? "border-gold-400 bg-gold-50 text-admin-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold-500)_35%,transparent)]"
                        : "border-admin-border bg-admin-surface text-admin-foreground/60 hover:border-gold-300 hover:bg-admin-muted/50",
                    )}
                  >
                    <span className="text-sm font-semibold">{item}</span>
                    <span className="text-[10px] leading-tight opacity-70">{LEVEL_HINT[item]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-group-maxStudents" className="text-admin-foreground">
                  Máximo de alunos
                </Label>
                <Input
                  id="edit-group-maxStudents"
                  name="maxStudents"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={group.maxStudents}
                  className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
                />
                <FieldError messages={fields?.["maxStudents"]} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-group-startDate" className="text-admin-foreground">
                  Início
                </Label>
                <DateField
                  id="edit-group-startDate"
                  name="startDate"
                  tone="admin"
                  defaultValue={group.startDate ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-group-endDate" className="text-admin-foreground">
                  Fim
                </Label>
                <DateField
                  id="edit-group-endDate"
                  name="endDate"
                  tone="admin"
                  defaultValue={group.endDate ?? ""}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-admin-border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-admin-foreground/50" />
                  <Label className="text-admin-foreground">Horários semanais</Label>
                </div>
                {!editSchedule && (
                  <button
                    type="button"
                    onClick={() => setEditSchedule(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gold-400/60 px-2.5 py-1.5 text-xs font-medium text-gold-700 transition-colors hover:bg-gold-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                    Alterar grade
                  </button>
                )}
              </div>

              {editSchedule ? (
                <>
                  <ScheduleBuilder tone="admin" initial={group.schedule} />
                  <p className="text-xs text-admin-foreground/55">
                    Ao salvar, as sessões futuras desta turma são regeradas a partir da nova grade.
                  </p>
                </>
              ) : (
                <p className="text-sm text-admin-foreground/65">{scheduleSummary(group.schedule)}</p>
              )}
              <FieldError messages={fields?.["schedule"]} />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-admin-border p-3.5 transition-colors hover:bg-admin-muted/40">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={group.isActive}
                className="mt-0.5 h-4 w-4 accent-[var(--gold-600)]"
              />
              <span>
                <span className="block text-sm font-medium text-admin-foreground">Turma ativa</span>
                <span className="mt-0.5 block text-xs text-admin-foreground/55">
                  Turmas arquivadas somem da operação do dia a dia, mas mantêm histórico, matrículas
                  e sessões já registradas.
                </span>
              </span>
            </label>
          </div>

          <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-3 border-t border-admin-border bg-admin-surface px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-admin-border px-4 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-5 text-sm font-semibold text-admin-foreground",
                "shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-60",
              )}
            >
              {isPending ? (
                <>
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                "Salvar alterações"
              )}
            </button>
          </div>
        </form>
      )}
    </SidePanel>
  );
}
