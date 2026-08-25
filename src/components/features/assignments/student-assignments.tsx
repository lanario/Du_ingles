"use client";

/**
 * A lista de tarefas do aluno, organizada pela pergunta que ele realmente faz
 * ao abrir a tela: "o que ainda preciso fazer?". Por isso o corte primário é
 * por situação (a fazer / entregue / corrigida) e não por turma — dentro de
 * "a fazer", o que venceu vem primeiro e o prazo aparece em dias, porque
 * "vence amanhã" empurra mais do que "12/09".
 */

import Link from "next/link";
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, CheckIcon, TaskIcon } from "@/components/ui/icons";
import { StatusPill } from "@/components/features/assignments/status-pill";
import { cn } from "@/lib/utils";
import type { AssignmentListItem } from "@/repositories/assignments";

const TZ = "America/Sao_Paulo";

/** Dias inteiros até o prazo, contados por data e não por relógio: uma tarefa
 * que vence hoje às 23h não pode aparecer como "vence em 0 dias" de manhã. */
function daysUntil(dueAt: string): number {
  const startOfDay = (value: Date) =>
    Date.parse(formatInTimeZone(value, TZ, "yyyy-MM-dd") + "T00:00:00Z");
  return Math.round(
    (startOfDay(new Date(dueAt)) - startOfDay(new Date())) / 86_400_000,
  );
}

function dueLabel(dueAt: string): string {
  const days = daysUntil(dueAt);
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  if (days === -1) return "venceu ontem";
  if (days > 1 && days <= 14) return `vence em ${days} dias`;
  if (days < -1) return `venceu há ${Math.abs(days)} dias`;
  return `até ${formatInTimeZone(new Date(dueAt), TZ, "d 'de' MMM", { locale: ptBR })}`;
}

interface Section {
  key: string;
  title: string;
  hint: string;
  items: AssignmentListItem[];
}

export function StudentAssignments({
  assignments,
}: {
  assignments: AssignmentListItem[];
}) {
  const reduceMotion = useReducedMotion();

  const { sections, todo, overdue, graded } = useMemo(() => {
    const isTodo = (a: AssignmentListItem) =>
      a.myStatus === "pending" || a.myStatus === "late";

    const todoItems = assignments.filter(isTodo).sort((a, b) => {
      // Sem prazo é o que menos pressiona: vai para o fim da fila.
      if (!a.dueAt) return b.dueAt ? 1 : 0;
      if (!b.dueAt) return -1;
      return Date.parse(a.dueAt) - Date.parse(b.dueAt);
    });

    const submitted = assignments.filter((a) => a.myStatus === "submitted");
    const gradedItems = assignments.filter((a) => a.myStatus === "graded");

    const built: Section[] = [
      {
        key: "todo",
        title: "A fazer",
        hint: "Responda direto por aqui.",
        items: todoItems,
      },
      {
        key: "submitted",
        title: "Aguardando correção",
        hint: "Já entregues — seu professor vai avaliar.",
        items: submitted,
      },
      {
        key: "graded",
        title: "Corrigidas",
        hint: "Com nota e comentário do professor.",
        items: gradedItems,
      },
    ];

    return {
      sections: built.filter((section) => section.items.length > 0),
      todo: todoItems.length,
      overdue: todoItems.filter((a) => a.myStatus === "late").length,
      graded: gradedItems.length,
    };
  }, [assignments]);

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
        <p className="font-medium text-navy-900">Nenhuma tarefa por aqui ainda.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando seu professor publicar uma tarefa, ela aparece nesta lista.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2.5">
        <Stat label={todo === 1 ? "tarefa a fazer" : "tarefas a fazer"} value={todo} />
        {overdue > 0 && (
          <Stat
            label={overdue === 1 ? "atrasada" : "atrasadas"}
            value={overdue}
            tone="danger"
          />
        )}
        <Stat
          label={graded === 1 ? "corrigida" : "corrigidas"}
          value={graded}
          tone="success"
        />
      </div>

      {sections.map((section) => (
        <section key={section.key}>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-900">
              {section.title}
            </h2>
            <p className="text-xs text-muted-foreground">{section.hint}</p>
          </div>

          <ul className="space-y-2.5">
            {section.items.map((assignment, index) => (
              <motion.li
                key={assignment.id}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(index * 0.04, 0.24),
                  ease: "easeOut",
                }}
              >
                <AssignmentCard assignment={assignment} />
              </motion.li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: AssignmentListItem }) {
  const late = assignment.myStatus === "late";
  const graded = assignment.myStatus === "graded";

  return (
    <Link
      href={`/tarefas/${assignment.id}`}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border bg-background p-4 shadow-[var(--shadow-card)] transition-all",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
        late
          ? "border-destructive/40 hover:border-destructive/60"
          : "border-border hover:border-navy-200",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 flex-none items-center justify-center rounded-xl transition-colors",
          graded
            ? "bg-success/10 text-success"
            : late
              ? "bg-destructive/10 text-destructive"
              : "bg-navy-50 text-navy-700 group-hover:bg-navy-100",
        )}
      >
        {graded ? <CheckIcon className="h-5 w-5" /> : <TaskIcon className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-navy-900">{assignment.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {assignment.groupName}
          {assignment.questionCount ? (
            <>
              {" · "}
              {assignment.questionCount} quest
              {assignment.questionCount === 1 ? "ão" : "ões"}
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-none flex-col items-end gap-1.5">
        {graded && assignment.myScore != null ? (
          <span className="text-sm font-semibold text-success">
            {assignment.myScore}
            {assignment.maxScore ? ` / ${assignment.maxScore}` : ""}
          </span>
        ) : (
          <StatusPill status={assignment.myStatus ?? "pending"} />
        )}

        {assignment.dueAt && (
          <p
            className={cn(
              "flex items-center gap-1 text-xs",
              late ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {dueLabel(assignment.dueAt)}
          </p>
        )}
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-1.5 rounded-xl border px-3.5 py-2",
        tone === "danger" && "border-destructive/30 bg-destructive/5",
        tone === "success" && "border-success/30 bg-success/5",
        tone === "default" && "border-border bg-muted/40",
      )}
    >
      <span
        className={cn(
          "text-lg font-semibold leading-none",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success",
          tone === "default" && "text-navy-900",
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
