"use client";

import { useActionState } from "react";
import { createGroupAction } from "@/actions/admin/groups";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { ScheduleBuilder } from "@/components/features/admin/groups/schedule-builder";
import { CEFR_LEVELS } from "@/types/domain";
import type { Course } from "@/repositories/courses";
import type { UserListItem } from "@/repositories/users";

export function CreateGroupForm({
  courses,
  teachers,
}: {
  courses: Course[];
  teachers: UserListItem[];
}) {
  const [state, formAction, isPending] = useActionState(createGroupAction, null);

  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nome da turma</Label>
        <Input id="name" name="name" required />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["name"] : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="teacherId">Professor</Label>
          <select
            id="teacherId"
            name="teacherId"
            required
            className="h-10 w-full rounded-md border border-admin-border bg-admin-background px-3 text-sm"
          >
            <option value="">Selecione…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
          <FieldError
            messages={
              state && !state.success ? state.error.fields?.["teacherId"] : undefined
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="courseId">Curso (opcional)</Label>
          <select
            id="courseId"
            name="courseId"
            className="h-10 w-full rounded-md border border-admin-border bg-admin-background px-3 text-sm"
          >
            <option value="">Nenhum</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="level">Nível</Label>
          <select
            id="level"
            name="level"
            className="h-10 w-full rounded-md border border-admin-border bg-admin-background px-3 text-sm"
          >
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxStudents">Máximo de alunos</Label>
          <Input
            id="maxStudents"
            name="maxStudents"
            type="number"
            min={1}
            defaultValue={12}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Início (opcional)</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">Fim (opcional)</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Horários semanais</Label>
        <ScheduleBuilder />
        <FieldError
          messages={
            state && !state.success ? state.error.fields?.["schedule"] : undefined
          }
        />
        <p className="text-xs text-admin-foreground/60">
          As sessões das próximas 4 semanas são geradas automaticamente ao criar a turma.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-admin-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Criando…" : "Criar turma"}
      </button>
    </form>
  );
}
