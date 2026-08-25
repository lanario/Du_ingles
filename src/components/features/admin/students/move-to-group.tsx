"use client";

/**
 * Escolha de turma para um aluno — diálogo curto de propósito único: a
 * lista de turmas ativas, mais "Sem turma". Criar turma não é uma opção
 * daqui de propósito: turma tem professor, horário e lotação, que são
 * decisões de `/admin/turmas`, não algo para resolver de passagem.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { moveStudentToGroupAction } from "@/actions/admin/students";
import { CheckIcon, CloseIcon, GroupsIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { GroupListItem } from "@/repositories/groups";
import type { Student } from "./students-utils";
import { LogoLoader } from "@/components/ui/logo-loader";

interface MoveToGroupProps {
  open: boolean;
  student: Student | null;
  groups: GroupListItem[];
  onClose: () => void;
}

export function MoveToGroup({ open, student, groups, onClose }: MoveToGroupProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && student && (
        <Content key={student.id} student={student} groups={groups} onClose={onClose} />
      )}
    </AnimatePresence>
  );
}

function Content({
  student,
  groups,
  onClose,
}: {
  student: Student;
  groups: GroupListItem[];
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentGroupId = student.enrollment?.groupId ?? null;

  async function move(groupId: string | null) {
    setSaving(groupId ?? "sem-turma");
    setError(null);
    try {
      const result = await moveStudentToGroupAction(student.id, groupId);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      onClose();
    } finally {
      setSaving(null);
    }
  }

  const busy = saving !== null;
  const eligible = groups.filter((group) => group.isActive || group.id === currentGroupId);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-navy-950/55 backdrop-blur-sm"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mover-turma-titulo"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="relative flex w-full max-w-sm flex-col rounded-2xl border border-admin-border bg-admin-surface p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="mover-turma-titulo" className="text-base font-semibold text-admin-foreground">
              Mover para turma
            </h2>
            <p className="mt-1 truncate text-sm text-admin-foreground/60">{student.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-admin-foreground/50 transition-colors hover:bg-admin-muted hover:text-admin-foreground"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {eligible.map((group) => (
            <GroupOption
              key={group.id}
              name={group.name}
              detail={`${group.level} · ${group.enrolledCount}/${group.maxStudents}`}
              current={currentGroupId === group.id}
              loading={saving === group.id}
              disabled={busy || group.enrolledCount >= group.maxStudents}
              onClick={() => move(group.id)}
            />
          ))}

          <GroupOption
            name="Sem turma"
            current={currentGroupId === null}
            loading={saving === "sem-turma"}
            disabled={busy}
            dashed
            onClick={() => move(null)}
          />
        </div>

        <p className="mt-3 text-xs text-admin-foreground/45">
          Um aluno fica em uma turma por vez — escolher outra encerra a matrícula atual.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {error}
          </p>
        )}
      </motion.div>
    </div>
  );
}

function GroupOption({
  name,
  detail,
  current,
  loading,
  disabled,
  dashed,
  onClick,
}: {
  name: string;
  detail?: string;
  current: boolean;
  loading: boolean;
  disabled: boolean;
  dashed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || current}
      aria-current={current ? "true" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        dashed && "border-dashed",
        current
          ? "border-gold-500 bg-gold-50 text-admin-foreground"
          : "border-admin-border text-admin-foreground/70 hover:border-gold-300 hover:text-admin-foreground",
        disabled && !current && "opacity-60",
      )}
    >
      <GroupsIcon className={cn("h-4 w-4 shrink-0", current ? "text-gold-600" : "opacity-60")} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{name}</span>
        {detail && <span className="block text-xs text-admin-foreground/45">{detail}</span>}
      </span>
      {loading ? (
        <LogoLoader size={14} label={null} className="text-gold-600" />
      ) : current ? (
        <CheckIcon className="h-3.5 w-3.5 text-gold-600" />
      ) : null}
    </button>
  );
}
