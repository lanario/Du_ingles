"use client";

/**
 * Objetivos da turma: o professor (ou a coordenação) registra uma meta para
 * todo mundo matriculado ali, e ela aparece marcável como concluída — o
 * espelho, do lado de quem ensina, do card "Meus objetivos" na tela de
 * progresso do aluno.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createGroupObjectiveAction,
  deleteObjectiveAction,
  toggleObjectiveCompletedAction,
} from "@/actions/admin/objectives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormBanner } from "@/components/ui/form-message";
import { CheckIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { LogoLoader } from "@/components/ui/logo-loader";
import { cn } from "@/lib/utils";
import type { ObjectiveItem } from "@/repositories/objectives";

export function GroupObjectives({
  groupId,
  objectives,
}: {
  groupId: string;
  objectives: ObjectiveItem[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, startCreate] = useTransition();

  function create() {
    if (!title.trim()) return;
    setError(null);
    startCreate(async () => {
      const result = await createGroupObjectiveAction(groupId, {
        title,
        description: description || undefined,
      });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setTitle("");
      setDescription("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <FormBanner tone="error">{error}</FormBanner>}

      <div className="space-y-2 rounded-xl border border-admin-border p-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="objective-title">Novo objetivo</Label>
          <Input
            id="objective-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Praticar phrasal verbs do dia a dia"
          />
        </div>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Detalhes (opcional)"
          rows={2}
          className="w-full rounded-md border border-admin-border bg-admin-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={create}
          disabled={isCreating || !title.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-semibold text-admin-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isCreating ? (
            <LogoLoader size={14} label={null} />
          ) : (
            <PlusIcon className="h-3.5 w-3.5" />
          )}
          Adicionar
        </button>
      </div>

      {objectives.length === 0 ? (
        <p className="rounded-xl border border-dashed border-admin-border px-4 py-8 text-center text-sm text-admin-foreground/50">
          Nenhum objetivo atribuído a esta turma ainda.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-admin-border">
          <AnimatePresence initial={false} mode="popLayout">
            {objectives.map((objective) => (
              <ObjectiveRow key={objective.id} objective={objective} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function ObjectiveRow({ objective }: { objective: ObjectiveItem }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [toggling, startToggle] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [removing, startRemove] = useTransition();

  return (
    <motion.li
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-3 border-b border-admin-border bg-admin-surface px-3.5 py-3 text-sm last:border-0"
    >
      <button
        type="button"
        disabled={toggling}
        onClick={() =>
          startToggle(async () => {
            await toggleObjectiveCompletedAction(objective.id, !objective.isCompleted);
            router.refresh();
          })
        }
        aria-pressed={objective.isCompleted}
        aria-label={
          objective.isCompleted ? "Marcar como não concluído" : "Marcar como concluído"
        }
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50",
          objective.isCompleted
            ? "border-success bg-success/15 text-success"
            : "border-admin-border text-transparent hover:border-gold-400",
        )}
      >
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-medium",
            objective.isCompleted
              ? "text-admin-foreground/50 line-through"
              : "text-admin-foreground",
          )}
        >
          {objective.title}
        </p>
        {objective.description && (
          <p className="mt-0.5 text-xs text-admin-foreground/50">
            {objective.description}
          </p>
        )}
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={removing}
            onClick={() =>
              startRemove(async () => {
                await deleteObjectiveAction(objective.id);
                setConfirming(false);
                router.refresh();
              })
            }
            className="rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {removing ? "Excluindo…" : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg border border-admin-border px-2.5 py-1.5 text-xs text-admin-foreground/60 transition-colors hover:bg-admin-muted"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Excluir objetivo "${objective.title}"`}
          title="Excluir objetivo"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-admin-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
    </motion.li>
  );
}
