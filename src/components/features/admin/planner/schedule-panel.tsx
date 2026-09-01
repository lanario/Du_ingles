"use client";

/**
 * Agendar a aula para uma turma. É o elo entre o ateliê e a sala: escolhe o
 * plano, a turma, o dia e a hora — e a partir daí a aula existe na agenda de
 * todo mundo (professor, aluno, relatórios), pronta para ser dada.
 *
 * O professor vem preenchido com o titular da turma e só aparece como campo
 * quando o admin quer trocar: é a escolha certa em 95% dos agendamentos.
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { scheduleSessionAction } from "@/actions/admin/lesson-planner";
import { SidePanel } from "@/components/ui/side-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";
import { defaultScheduleParts } from "./planner-utils";
import type { PlannerGroupOption, PlannerPlan } from "@/repositories/lesson-planner";
import type { UserListItem } from "@/repositories/users";
import { LogoLoader } from "@/components/ui/logo-loader";

const DURATIONS = [30, 45, 60, 90, 120];

export function SchedulePanel({
  open,
  onClose,
  groups,
  plans,
  teachers,
  defaultPlanId,
}: {
  open: boolean;
  onClose: () => void;
  groups: PlannerGroupOption[];
  plans: PlannerPlan[];
  teachers: UserListItem[];
  defaultPlanId?: string;
}) {
  const [state, formAction, isPending] = useActionState(scheduleSessionAction, null);

  const initial = useMemo(() => defaultScheduleParts(), []);
  const [planId, setPlanId] = useState(defaultPlanId ?? "");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [duration, setDuration] = useState(60);
  const [customTeacher, setCustomTeacher] = useState(false);
  const [title, setTitle] = useState("");

  const plan = plans.find((item) => item.id === planId);
  const group = groups.find((item) => item.id === groupId);
  const fields = state && !state.success ? state.error.fields : undefined;

  useEffect(() => {
    if (open) setPlanId(defaultPlanId ?? "");
  }, [open, defaultPlanId]);

  // O título do plano é um bom título de aula; quem quiser outro sobrescreve.
  useEffect(() => {
    if (plan) {
      setTitle(plan.title);
      setDuration(plan.durationMinutes);
    }
  }, [plan]);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const noGroups = groups.length === 0;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Agendar aula"
      subtitle="Escolha a turma e o horário — a aula entra na agenda e pode ser dada daqui."
      wide
    >
      <form action={formAction} className="flex min-h-full flex-col" noValidate>
        <div className="flex-1 space-y-5 px-4 py-5 sm:px-6">
          {/* O banner aparece em TODA falha, inclusive nas de validação. Um
              erro num campo que não está na tela (o professor, escondido
              atrás do "trocar") não tem onde se mostrar inline — sem isto o
              clique em "Agendar aula" não fazia nada e não dizia nada. */}
          {state && !state.success && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          {noGroups && (
            <FormBanner tone="error">
              Nenhuma turma ativa. Crie uma turma antes de agendar a aula.
            </FormBanner>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="session-lessonPlanId" className="text-admin-foreground">
              Plano de aula
            </Label>
            <Select
              id="session-lessonPlanId"
              name="lessonPlanId"
              tone="admin"
              value={planId}
              onChange={setPlanId}
            >
              <option value="">Sem plano — montar na hora</option>
              {plans.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.level} · {item.title}
                </option>
              ))}
            </Select>
            <p className="text-xs text-admin-foreground/55">
              O conteúdo é copiado para a aula ao iniciar — editar durante a aula não
              altera o plano original.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="session-title" className="text-admin-foreground">
              Título da aula <span className="text-gold-600">*</span>
            </Label>
            <Input
              id="session-title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Present Perfect — experiências de viagem"
              required
              className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
            />
            <FieldError messages={fields?.["title"]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="session-groupId" className="text-admin-foreground">
              Turma <span className="text-gold-600">*</span>
            </Label>
            <Select
              id="session-groupId"
              name="groupId"
              tone="admin"
              value={groupId}
              onChange={setGroupId}
              required
              disabled={noGroups}
            >
              {groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.level} · {item.studentCount} aluno(s)
                </option>
              ))}
            </Select>
            <FieldError messages={fields?.["groupId"]} />
          </div>

          <div className="rounded-xl border border-admin-border bg-admin-background p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-admin-foreground/70">
                Professor:{" "}
                <strong className="font-medium text-admin-foreground">
                  {customTeacher ? "escolher outro" : (group?.teacherName ?? "—")}
                </strong>
              </p>
              <button
                type="button"
                onClick={() => setCustomTeacher((value) => !value)}
                className="text-xs font-medium text-navy-700 underline underline-offset-2"
              >
                {customTeacher ? "usar o titular" : "trocar"}
              </button>
            </div>

            {customTeacher && (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="session-teacherId" className="text-admin-foreground">
                  Professor da aula
                </Label>
                <Select id="session-teacherId" name="teacherId" tone="admin" defaultValue="">
                  <option value="">Titular da turma</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.fullName}
                    </option>
                  ))}
                </Select>
                <FieldError messages={fields?.["teacherId"]} />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="session-date" className="text-admin-foreground">
                Data <span className="text-gold-600">*</span>
              </Label>
              <DateField
                id="session-date"
                name="date"
                tone="admin"
                defaultValue={initial.date}
                required
              />
              <FieldError messages={fields?.["date"]} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-time" className="text-admin-foreground">
                Horário <span className="text-gold-600">*</span>
              </Label>
              <TimeField
                id="session-time"
                name="time"
                tone="admin"
                defaultValue={initial.time}
                required
              />
              <FieldError messages={fields?.["time"]} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-admin-foreground">Duração</legend>
            <input type="hidden" name="durationMinutes" value={duration} />
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDuration(minutes)}
                  aria-pressed={duration === minutes}
                  className={cn(
                    "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                    duration === minutes
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-admin-border text-admin-foreground/70 hover:bg-admin-muted",
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </fieldset>
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
            disabled={isPending || noGroups}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-5 text-sm font-semibold text-admin-foreground",
              "shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            {isPending ? (
              <>
                <LogoLoader size={16} label={null} />
                Agendando…
              </>
            ) : (
              "Agendar aula"
            )}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}
