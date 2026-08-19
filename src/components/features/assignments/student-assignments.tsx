"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarIcon, TaskIcon } from "@/components/ui/icons";
import { StatusPill } from "@/components/features/assignments/status-pill";
import type { AssignmentListItem } from "@/repositories/assignments";

export function StudentAssignments({
  assignments,
}: {
  assignments: AssignmentListItem[];
}) {
  const reduceMotion = useReducedMotion();

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
    <ul className="space-y-2.5">
      {assignments.map((assignment, index) => (
        <motion.li
          key={assignment.id}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.24), ease: "easeOut" }}
        >
          <Link
            href={`/tarefas/${assignment.id}`}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-[var(--shadow-card-hover)]"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-navy-50 text-navy-700 transition-colors group-hover:bg-navy-100">
              <TaskIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-navy-900">{assignment.title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {assignment.groupName}
              </p>
            </div>
            <div className="flex flex-none flex-col items-end gap-1.5">
              <StatusPill status={assignment.myStatus ?? "pending"} />
              {assignment.dueAt && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {new Date(assignment.dueAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}
