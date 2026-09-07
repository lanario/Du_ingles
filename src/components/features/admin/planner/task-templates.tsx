"use client";

/**
 * Ateliê de tarefas — montar um exercício sem escolher turma ainda, e
 * atribuí-lo depois. Mesma ideia do ateliê de aulas (`plan-folders.tsx`,
 * `plan-form-panel.tsx`): o conteúdo nasce solto, a turma vem só na hora de
 * usar. Aqui "usar" é `assignTemplateToGroupsAction`, que copia o exercício
 * pronto para uma linha de `assignments` por turma escolhida.
 */

import { useActionState, useEffect, useState } from "react";
import {
  assignTemplateToGroupsAction,
  createAssignmentTemplateAction,
} from "@/actions/admin/assignments";
import { QuestionBuilder } from "./question-builder";
import { SidePanel } from "@/components/ui/side-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { CheckIcon, PlusIcon, TaskIcon, TrashIcon } from "@/components/ui/icons";
import { LogoLoader } from "@/components/ui/logo-loader";
import { cn } from "@/lib/utils";
import type { AssignmentTemplateListItem } from "@/repositories/assignments";
import type { PlannerGroupOption } from "@/repositories/lesson-planner";

export function TaskTemplateCard({
  template,
  busy,
  onAssign,
  onDelete,
}: {
  template: AssignmentTemplateListItem;
  busy: boolean;
  onAssign: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-admin-border bg-admin-surface p-4 transition-[border-color,box-shadow] hover:border-navy-100 hover:shadow-[0_18px_40px_-32px_rgba(11,26,51,0.6)]">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-700">
          <TaskIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-admin-foreground">{template.title}</p>
          <p className="mt-0.5 truncate text-xs text-admin-foreground/55">
            {template.questionCount > 0
              ? `${template.questionCount} questão(ões)`
              : "resposta livre"}
            {template.maxScore != null ? ` · nota máxima ${template.maxScore}` : ""}
          </p>
        </div>
        <button
          type="button"
          title="Excluir tarefa padrão"
          aria-label="Excluir tarefa padrão"
          disabled={busy}
          onClick={onDelete}
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-admin-border bg-admin-surface text-admin-foreground/50 transition-colors",
            "hover:border-red-200 hover:bg-red-50 hover:text-red-600",
            busy && "pointer-events-none opacity-50",
          )}
        >
          {busy ? (
            <LogoLoader size={16} label={null} />
          ) : (
            <TrashIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {template.instructionsText && (
        <p className="line-clamp-2 text-sm text-admin-foreground/70">
          {template.instructionsText}
        </p>
      )}

      <div className="mt-1 flex items-center justify-between gap-3">
        {template.assignedGroupCount > 0 ? (
          <span className="inline-flex h-6 items-center rounded-full border border-navy-100 bg-navy-50 px-2.5 text-[11px] font-semibold text-navy-800">
            atribuída a {template.assignedGroupCount} turma(s)
          </span>
        ) : (
          <span className="text-[11px] text-admin-foreground/45">
            ainda não atribuída
          </span>
        )}
        <button
          type="button"
          onClick={onAssign}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold-600 to-gold-400 px-3.5 text-xs font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          Atribuir a turmas
        </button>
      </div>
    </div>
  );
}

/** Montar a tarefa padrão: título, instruções, questões — sem turma nenhuma. */
export function TaskTemplateFormPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    createAssignmentTemplateAction,
    null,
  );
  // O construtor de questões guarda o rascunho em estado próprio; trocar a
  // chave a cada abertura é o que garante painel novo = tarefa em branco.
  const [builderKey, setBuilderKey] = useState(0);

  const fields = state && !state.success ? state.error.fields : undefined;

  useEffect(() => {
    if (open) setBuilderKey((k) => k + 1);
  }, [open]);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Nova tarefa padrão"
      subtitle="Monte o exercício uma vez e guarde no ateliê — escolha as turmas só na hora de atribuir."
      wide
    >
      <form action={formAction} className="flex min-h-full flex-col" noValidate>
        <div className="flex-1 space-y-5 px-4 py-5 sm:px-6">
          {state && !state.success && !state.error.fields && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="template-title" className="text-admin-foreground">
              Título <span className="text-gold-600">*</span>
            </Label>
            <Input
              id="template-title"
              name="title"
              placeholder="Ex.: Exercícios de Present Perfect"
              autoComplete="off"
              required
              className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
            />
            <FieldError messages={fields?.["title"]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-instructions" className="text-admin-foreground">
              Instruções para o aluno
            </Label>
            <textarea
              id="template-instructions"
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

          <div className="space-y-1.5">
            <Label htmlFor="template-maxScore" className="text-admin-foreground">
              Nota máxima
            </Label>
            <Input
              id="template-maxScore"
              name="maxScore"
              type="number"
              min={0}
              max={1000}
              step="0.1"
              defaultValue={10}
              className="max-w-[10rem] border-admin-border bg-admin-background focus-visible:ring-gold-500"
            />
            <FieldError messages={fields?.["maxScore"]} />
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
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-5 text-sm font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-60"
          >
            {isPending ? (
              <>
                <LogoLoader size={16} label={null} />
                Salvando…
              </>
            ) : (
              "Salvar tarefa padrão"
            )}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}

/** Escolher turmas (e ajustar prazo/nota) para uma tarefa padrão já pronta. */
export function AssignTemplatePanel({
  open,
  onClose,
  template,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  template: AssignmentTemplateListItem | null;
  groups: PlannerGroupOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    assignTemplateToGroupsAction,
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fields = state && !state.success ? state.error.fields : undefined;
  const noGroups = groups.length === 0;
  const allSelected = groups.length > 0 && selected.size === groups.length;

  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open, template]);

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
      title={template ? `Atribuir "${template.title}"` : "Atribuir tarefa"}
      subtitle="Cada turma marcada vira sua própria entrega — prazo e nota valem para todas as selecionadas."
    >
      {template && (
        <form action={formAction} className="flex min-h-full flex-col" noValidate>
          <input type="hidden" name="templateId" value={template.id} />
          <div className="flex-1 space-y-5 px-4 py-5 sm:px-6">
            {state && !state.success && !state.error.fields && (
              <FormBanner tone="error">{state.error.message}</FormBanner>
            )}

            {noGroups && (
              <FormBanner tone="error">
                Nenhuma turma ativa. Crie uma turma antes de atribuir a tarefa.
              </FormBanner>
            )}

            <fieldset className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <legend className="text-sm font-medium text-admin-foreground">
                  Turmas <span className="text-gold-600">*</span>
                </legend>
                {!noGroups && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        allSelected ? new Set() : new Set(groups.map((g) => g.id)),
                      )
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
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="assign-dueAt" className="text-admin-foreground">
                  Prazo (opcional)
                </Label>
                <DateField
                  id="assign-dueAt"
                  name="dueAt"
                  tone="admin"
                  min={new Date().toISOString().slice(0, 10)}
                />
                <FieldError messages={fields?.["dueAt"]} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assign-maxScore" className="text-admin-foreground">
                  Nota máxima
                </Label>
                <Input
                  id="assign-maxScore"
                  name="maxScore"
                  type="number"
                  min={0}
                  max={1000}
                  step="0.1"
                  placeholder={
                    template.maxScore != null ? String(template.maxScore) : "10"
                  }
                  className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
                />
                <p className="text-xs text-admin-foreground/55">
                  Em branco, usa a nota máxima da tarefa padrão.
                </p>
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-5 text-sm font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <LogoLoader size={16} label={null} />
                  Atribuindo…
                </>
              ) : (
                "Atribuir tarefa"
              )}
            </button>
          </div>
        </form>
      )}
    </SidePanel>
  );
}

/** Botão "Nova tarefa padrão" — mesmo visual do resto dos CTAs do ateliê. */
export function NewTemplateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
    >
      <PlusIcon className="h-4 w-4" />
      Nova tarefa padrão
    </button>
  );
}
