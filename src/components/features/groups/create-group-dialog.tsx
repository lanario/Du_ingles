"use client";

import { useActionState, useEffect, useState } from "react";
import { createGroupAction } from "@/actions/teacher/groups";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { PlusIcon } from "@/components/ui/icons";
import { ScheduleBuilder } from "@/components/features/admin/groups/schedule-builder";
import { CEFR_LEVELS } from "@/types/domain";
import type { Course } from "@/repositories/courses";
import type { UserListItem } from "@/repositories/users";

export function CreateGroupDialog({
  courses,
  teachers,
}: {
  courses: Course[];
  /** Presente só para o admin — professor nunca escolhe o dono, é sempre ele. */
  teachers?: UserListItem[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createGroupAction, null);

  // Fecha só quando a action confirmou — fechar no clique deixaria o professor
  // sem ver o erro de validação que voltou do servidor.
  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  const fields = state && !state.success ? state.error.fields : undefined;

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="gap-2 rounded-xl bg-primary"
      >
        <PlusIcon className="h-4 w-4" />
        Nova turma
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Nova turma"
        description="As sessões das próximas 4 semanas são geradas assim que a turma é criada."
      >
        <form action={formAction} className="space-y-4" noValidate>
          {state && !state.success && !state.error.fields && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="group-name">Nome da turma</Label>
            <Input id="group-name" name="name" required autoComplete="off" />
            <FieldError messages={fields?.["name"]} />
          </div>

          {teachers && (
            <div className="space-y-1.5">
              <Label htmlFor="group-teacher">Professor responsável</Label>
              <Select id="group-teacher" name="teacherId" defaultValue="">
                <option value="">Selecione…</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </option>
                ))}
              </Select>
              <FieldError messages={fields?.["teacherId"]} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-course">Curso (opcional)</Label>
              <Select id="group-course" name="courseId" defaultValue="">
                <option value="">Nenhum</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-level">Nível</Label>
              <Select id="group-level" name="level" defaultValue="A1">
                {CEFR_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
              <FieldError messages={fields?.["level"]} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="group-max">Máx. de alunos</Label>
              <Input
                id="group-max"
                name="maxStudents"
                type="number"
                min={1}
                max={100}
                defaultValue={12}
              />
              <FieldError messages={fields?.["maxStudents"]} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-start">Início (opcional)</Label>
              <Input id="group-start" name="startDate" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-end">Fim (opcional)</Label>
              <Input id="group-end" name="endDate" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Horários semanais</Label>
            <ScheduleBuilder tone="app" />
            <FieldError messages={fields?.["schedule"]} />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Criando…" : "Criar turma"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
