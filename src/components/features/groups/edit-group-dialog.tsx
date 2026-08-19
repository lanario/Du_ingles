"use client";

import { useActionState, useEffect } from "react";
import { updateGroupAction } from "@/actions/teacher/groups";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { ScheduleBuilder } from "@/components/features/admin/groups/schedule-builder";
import { CEFR_LEVELS } from "@/types/domain";
import type { Course } from "@/repositories/courses";
import type { GroupDetail } from "@/repositories/groups";
import type { UserListItem } from "@/repositories/users";

export function EditGroupDialog({
  group,
  open,
  onClose,
  courses,
  teachers,
}: {
  group: GroupDetail | null;
  open: boolean;
  onClose: () => void;
  courses: Course[];
  /** Presente só para o admin — só ele reatribui o professor responsável. */
  teachers?: UserListItem[];
}) {
  const [state, formAction, isPending] = useActionState(updateGroupAction, null);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const fields = state && !state.success ? state.error.fields : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={group ? `Editar ${group.name}` : "Editar turma"}
      description="Alterar os horários regenera as sessões das próximas 4 semanas."
    >
      {group && (
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={group.id} />

          {state && !state.success && !state.error.fields && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nome da turma</Label>
            <Input
              id="edit-name"
              name="name"
              required
              autoComplete="off"
              defaultValue={group.name}
            />
            <FieldError messages={fields?.["name"]} />
          </div>

          {teachers && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-teacher">Professor responsável</Label>
              <Select id="edit-teacher" name="teacherId" defaultValue={group.teacherId}>
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
              <Label htmlFor="edit-course">Curso (opcional)</Label>
              <Select
                id="edit-course"
                name="courseId"
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
            <div className="space-y-1.5">
              <Label htmlFor="edit-level">Nível</Label>
              <Select id="edit-level" name="level" defaultValue={group.level}>
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
              <Label htmlFor="edit-max">Máx. de alunos</Label>
              <Input
                id="edit-max"
                name="maxStudents"
                type="number"
                min={1}
                max={100}
                defaultValue={group.maxStudents}
              />
              <FieldError messages={fields?.["maxStudents"]} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">Início (opcional)</Label>
              <DateField
                id="edit-start"
                name="startDate"
                defaultValue={group.startDate ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">Fim (opcional)</Label>
              <DateField
                id="edit-end"
                name="endDate"
                defaultValue={group.endDate ?? ""}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Horários semanais</Label>
            <ScheduleBuilder tone="app" initial={group.schedule} />
            <FieldError messages={fields?.["schedule"]} />
          </div>

          <label className="flex items-center gap-2 text-sm text-navy-800">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={group.isActive}
              className="h-4 w-4 rounded border-border accent-navy-700"
            />
            Turma ativa
          </label>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
