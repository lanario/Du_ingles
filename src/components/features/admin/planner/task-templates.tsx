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
import { schoolDayKey } from "@/lib/schedule/session-preview";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import {
  CheckIcon,
  FolderMoveIcon,
  GripIcon,
  PlusIcon,
  TaskIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { LogoLoader } from "@/components/ui/logo-loader";
import { cn } from "@/lib/utils";
import type { AssignmentTemplateFolder, AssignmentTemplateListItem } from "@/repositories/assignments";
import type { PlannerGroupOption } from "@/repositories/lesson-planner";

export function TaskTemplateCard({
  template,
  busy,
  canEdit,
  onAssign,
  onMove,
  onDelete,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  template: AssignmentTemplateListItem;
  busy: boolean;
  /** Mover ou excluir esta tarefa padrão é permitido — falso em compartilhada alheia. */
  canEdit: boolean;
  onAssign: () => void;
  onMove: () => void;
  onDelete: () => void;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      /** O cartão inteiro é a alça — mesma ideia de `PlanCard` (`planner-view.tsx`),
       * mas sem o problema do link cobrindo tudo: aqui não há `<Link>` nenhum. */
      draggable={canEdit}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", template.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-admin-border bg-admin-surface p-4 transition-[border-color,box-shadow,opacity] hover:border-navy-100 hover:shadow-[0_18px_40px_-32px_rgba(11,26,51,0.6)]",
        canEdit && "cursor-grab active:cursor-grabbing",
        dragging && "border-gold-400 opacity-50",
      )}
    >
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
        {canEdit && (
          /** Só o ícone — o arrasto de verdade já é do cartão inteiro. */
          <span
            aria-hidden
            title="Arrastar para uma pasta"
            className="-mr-1 mt-1 shrink-0 rounded-md p-1 text-admin-foreground/30"
          >
            <GripIcon className="h-4 w-4" />
          </span>
        )}
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

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {template.assignedGroupCount > 0 ? (
          <span className="inline-flex h-6 items-center rounded-full border border-navy-100 bg-navy-50 px-2.5 text-[11px] font-semibold text-navy-800">
            atribuída a {template.assignedGroupCount} turma(s)
          </span>
        ) : (
          <span className="text-[11px] text-admin-foreground/45">
            ainda não atribuída
          </span>
        )}
        {template.isShared && (
          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700">
            compartilhada
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onAssign}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-gold-600 to-gold-400 px-3.5 text-xs font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          Atribuir a turmas
        </button>
        {canEdit && (
          <button
            type="button"
            title="Mover para pasta"
            aria-label="Mover para pasta"
            disabled={busy}
            onClick={onMove}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-admin-border bg-admin-surface text-admin-foreground/60 transition-colors",
              "hover:bg-admin-muted hover:text-admin-foreground",
              busy && "pointer-events-none opacity-50",
            )}
          >
            <FolderMoveIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Montar a tarefa padrão: título, instruções, questões — sem turma nenhuma. */
export function TaskTemplateFormPanel({
  open,
  onClose,
  folders,
  defaultFolderId = null,
}: {
  open: boolean;
  onClose: () => void;
  /** Estante de quem está criando — vazia enquanto ninguém criou pasta. */
  folders: AssignmentTemplateFolder[];
  /** Pasta aberta no ateliê: é onde a tarefa padrão nova nasce. */
  defaultFolderId?: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    createAssignmentTemplateAction,
    null,
  );
  // O construtor de questões guarda o rascunho em estado próprio; trocar a
  // chave a cada abertura é o que garante painel novo = tarefa em branco.
  const [builderKey, setBuilderKey] = useState(0);
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);

  const fields = state && !state.success ? state.error.fields : undefined;

  useEffect(() => {
    if (open) {
      setBuilderKey((k) => k + 1);
      setFolderId(defaultFolderId);
    }
  }, [open, defaultFolderId]);

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

          {folders.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-admin-foreground">Pasta</legend>
              <input type="hidden" name="folderId" value={folderId ?? ""} />
              <div className="flex flex-wrap gap-2">
                <TemplateFolderChip
                  label="Sem pasta"
                  active={folderId === null}
                  onSelect={() => setFolderId(null)}
                />
                {folders.map((folder) => (
                  <TemplateFolderChip
                    key={folder.id}
                    label={folder.name}
                    active={folderId === folder.id}
                    onSelect={() => setFolderId(folder.id)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-admin-border bg-admin-background p-3.5">
            <input
              type="checkbox"
              name="isShared"
              className="mt-0.5 h-4 w-4 accent-[var(--gold-500)]"
            />
            <span className="text-xs leading-relaxed text-admin-foreground/70">
              <strong className="block text-sm font-medium text-admin-foreground">
                Compartilhar com os professores
              </strong>
              Tarefas padrão compartilhadas aparecem no ateliê de quem dá aula, prontas
              para atribuir.
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
                  min={schoolDayKey()}
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

function TemplateFolderChip({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "h-9 max-w-[14rem] truncate rounded-full border px-3.5 text-sm font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        active
          ? "border-gold-400 bg-gold-50 text-admin-foreground"
          : "border-admin-border text-admin-foreground/70 hover:bg-admin-muted",
      )}
    >
      {label}
    </button>
  );
}
