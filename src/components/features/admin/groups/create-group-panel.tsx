"use client";

/**
 * Nova turma — painel lateral, mesmo container e visual do convite de
 * usuário (`InviteUserPanel`): `SidePanel`, cartões dourados de seleção,
 * rodapé fixo com Cancelar + ação primária em degradê.
 *
 * Diferença de fluxo: aqui não há "passo 2". `createGroupAction` já
 * redireciona para `/admin/turmas/[id]` ao criar — a navegação por si só
 * fecha o painel, então não existe um estado de sucesso para desenhar.
 *
 * `wide`: a grade de horários (`ScheduleBuilder`) tem select + dois campos
 * de hora por linha — no painel estreito (440px) ela quebraria linha a
 * cada horário.
 */

import { useActionState, useState } from "react";
import { createGroupAction } from "@/actions/admin/groups";
import { SidePanel } from "@/components/ui/side-panel";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { ScheduleBuilder } from "@/components/features/admin/groups/schedule-builder";
import { CalendarIcon, GraduationIcon, SpinnerIcon } from "@/components/ui/icons";
import { CEFR_LEVELS } from "@/types/domain";
import { cn } from "@/lib/utils";
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

export function CreateGroupPanel({
  open,
  onClose,
  courses,
  teachers,
}: {
  open: boolean;
  onClose: () => void;
  courses: Course[];
  teachers: UserListItem[];
}) {
  const [state, formAction, isPending] = useActionState(createGroupAction, null);
  const [level, setLevel] = useState<string>(CEFR_LEVELS[0] ?? "A1");

  const fields = state && !state.success ? state.error.fields : undefined;
  const noTeachers = teachers.length === 0;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Nova turma"
      subtitle="Defina professor, nível e horários — a turma fica pronta para matricular alunos."
      wide
    >
      <form action={formAction} className="flex min-h-full flex-col" noValidate>
        <div className="flex-1 space-y-5 px-4 py-5 sm:px-6">
          {state && !state.success && !state.error.fields && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          {noTeachers && (
            <div className="flex gap-3 rounded-xl border border-gold-300 bg-gold-50 p-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-500/20 text-gold-700">
                <GraduationIcon className="h-4 w-4" />
              </span>
              <p className="text-xs leading-relaxed text-admin-foreground/70">
                Nenhum professor cadastrado ainda. Convide um professor em{" "}
                <strong className="font-medium">Usuários</strong> antes de criar a turma.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="group-name" className="text-admin-foreground">
              Nome da turma <span className="text-gold-600">*</span>
            </Label>
            <Input
              id="group-name"
              name="name"
              placeholder="Ex.: Inglês B1 · Terça e Quinta"
              autoComplete="off"
              required
              className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
            />
            <FieldError messages={fields?.["name"]} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-teacherId" className="text-admin-foreground">
                Professor <span className="text-gold-600">*</span>
              </Label>
              <Select
                id="group-teacherId"
                name="teacherId"
                tone="admin"
                required
                disabled={noTeachers}
                defaultValue=""
              >
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </option>
                ))}
              </Select>
              <FieldError messages={fields?.["teacherId"]} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="group-courseId" className="text-admin-foreground">
                Curso
              </Label>
              <Select id="group-courseId" name="courseId" tone="admin" defaultValue="">
                <option value="">Nenhum</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-admin-foreground/55">Opcional — pode vincular depois.</p>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-admin-foreground">Nível (CEFR)</legend>
            <input type="hidden" name="level" value={level} />
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
                  <span className="text-[10px] leading-tight opacity-70">
                    {LEVEL_HINT[item]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="group-maxStudents" className="text-admin-foreground">
              Máximo de alunos
            </Label>
            <Input
              id="group-maxStudents"
              name="maxStudents"
              type="number"
              min={1}
              max={100}
              defaultValue={12}
              className="max-w-[10rem] border-admin-border bg-admin-background focus-visible:ring-gold-500"
            />
            <FieldError messages={fields?.["maxStudents"]} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-startDate" className="text-admin-foreground">
                Início
              </Label>
              <DateField id="group-startDate" name="startDate" tone="admin" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-endDate" className="text-admin-foreground">
                Fim
              </Label>
              <DateField id="group-endDate" name="endDate" tone="admin" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-admin-foreground/50" />
              <Label className="text-admin-foreground">
                Horários semanais <span className="text-gold-600">*</span>
              </Label>
            </div>
            <ScheduleBuilder tone="admin" />
            <FieldError messages={fields?.["schedule"]} />
          </div>
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
            disabled={isPending || noTeachers}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-5 text-sm font-semibold text-admin-foreground",
              "shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            {isPending ? (
              <>
                <SpinnerIcon className="h-4 w-4 animate-spin" />
                Criando…
              </>
            ) : (
              "Criar turma"
            )}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}
