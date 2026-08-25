"use client";

/**
 * Planejar uma tarefa/exercício e mandar para uma ou várias turmas de uma
 * vez. Ao contrário do agendamento de aula (uma turma por vez, porque uma
 * aula acontece num horário só), a mesma tarefa pode valer para turmas
 * diferentes — cada turma marcada vira sua própria linha em `assignments`,
 * com prazo e nota máxima compartilhados mas entregas independentes.
 */

import { useActionState, useEffect, useState } from "react";
import { createPlannerAssignmentAction } from "@/actions/admin/assignments";
import { QuestionBuilder } from "./question-builder";
import { SidePanel } from "@/components/ui/side-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { PlannerGroupOption } from "@/repositories/lesson-planner";
import { LogoLoader } from "@/components/ui/logo-loader";

export function AssignmentPanel({
  open,
  onClose,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  groups: PlannerGroupOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    createPlannerAssignmentAction,
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // O construtor de questões guarda o rascunho em estado próprio; trocar a
  // chave a cada abertura é o que garante painel novo = tarefa em branco.
  const [builderKey, setBuilderKey] = useState(0);

  const fields = state && !state.success ? state.error.fields : undefined;
  const noGroups = groups.length === 0;
  const allSelected = groups.length > 0 && selected.size === groups.length;

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setBuilderKey((k) => k + 1);
    }
  }, [open]);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Nova tarefa"
      subtitle="Monte as questões e escolha para quais turmas a tarefa vai — o aluno responde dentro do app, e cada turma tem sua própria entrega e nota."
      wide
    >
      <form action={formAction} className="flex min-h-full flex-col" noValidate>
        <div className="flex-1 space-y-5 px-4 py-5 sm:px-6">
          {state && !state.success && !state.error.fields && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          {noGroups && (
            <FormBanner tone="error">
              Nenhuma turma ativa. Crie uma turma antes de enviar uma tarefa.
            </FormBanner>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="assignment-title" className="text-admin-foreground">
              Título <span className="text-gold-600">*</span>
            </Label>
            <Input
              id="assignment-title"
              name="title"
              placeholder="Ex.: Exercícios de Present Perfect — página 24"
              autoComplete="off"
              required
              className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
            />
            <FieldError messages={fields?.["title"]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assignment-instructions" className="text-admin-foreground">
              Instruções para o aluno
            </Label>
            <textarea
              id="assignment-instructions"
              name="instructions"
              rows={4}
              maxLength={4000}
              placeholder="O que o aluno precisa fazer, responder ou trazer na próxima aula."
              className="w-full rounded-md border border-admin-border bg-admin-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            />
            <FieldError messages={fields?.["instructions"]} />
          </div>

          <div className="border-t border-admin-border pt-5">
            <QuestionBuilder key={builderKey} />
            <FieldError messages={fields?.["questions"]} />
          </div>

          <fieldset className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-medium text-admin-foreground">
                Turmas <span className="text-gold-600">*</span>
              </legend>
              {!noGroups && (
                <button
                  type="button"
                  onClick={() =>
                    setSelected(allSelected ? new Set() : new Set(groups.map((g) => g.id)))
                  }
                  className="text-xs font-medium text-navy-700 underline underline-offset-2"
                >
                  {allSelected ? "limpar seleção" : "selecionar todas"}
                </button>
              )}
            </div>

            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-admin-border bg-admin-background p-2">
              {noGroups ? (
                <p className="px-2 py-3 text-sm text-admin-foreground/50">
                  Nenhuma turma ativa.
                </p>
              ) : (
                groups.map((group) => {
                  const checked = selected.has(group.id);
                  return (
                    <label
                      key={group.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                        checked
                          ? "border-gold-400 bg-gold-50"
                          : "border-transparent hover:bg-admin-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="groupIds"
                        value={group.id}
                        checked={checked}
                        onChange={() => toggle(group.id)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-5 w-5 flex-none place-items-center rounded-md border transition-colors",
                          checked
                            ? "border-gold-500 bg-gold-500 text-white"
                            : "border-admin-border bg-admin-surface",
                        )}
                      >
                        {checked && <CheckIcon className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-admin-foreground">
                        {group.name}
                      </span>
                      <span className="shrink-0 text-xs text-admin-foreground/50">
                        {group.level} · {group.studentCount} aluno(s)
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <FieldError messages={fields?.["groupIds"]} />
            {selected.size > 0 && (
              <p className="text-xs text-admin-foreground/55">
                {selected.size} turma(s) selecionada(s).
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assignment-dueAt" className="text-admin-foreground">
                Prazo (opcional)
              </Label>
              <DateField
                id="assignment-dueAt"
                name="dueAt"
                tone="admin"
                min={new Date().toISOString().slice(0, 10)}
              />
              <FieldError messages={fields?.["dueAt"]} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assignment-maxScore" className="text-admin-foreground">
                Nota máxima
              </Label>
              <Input
                id="assignment-maxScore"
                name="maxScore"
                type="number"
                min={0}
                max={1000}
                step="0.1"
                defaultValue={10}
                className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
              />
              <FieldError messages={fields?.["maxScore"]} />
            </div>
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
            disabled={isPending || noGroups || selected.size === 0}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-5 text-sm font-semibold text-admin-foreground",
              "shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            {isPending ? (
              <>
                <LogoLoader size={16} label={null} />
                Enviando…
              </>
            ) : (
              "Enviar tarefa"
            )}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}
