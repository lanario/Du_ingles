"use client";

/**
 * O aviso de "um aluno, uma turma". Aparece sempre que a ação seguinte
 * colocaria o aluno numa segunda turma — matricular alguém que já está
 * matriculado, ou arrastar um cartão para outra turma na barra.
 *
 * O diálogo não bloqueia: explica o que vai acontecer com a matrícula atual e
 * deixa confirmar. Quem confirma está pedindo uma transferência, e é isso que
 * a server action recebe (`transfer: true`) — o servidor recusa a mesma
 * operação sem essa confirmação.
 *
 * `tone` acompanha o resto do design system (`Select tone="admin"`): a área
 * administrativa tem paleta própria, e o mesmo diálogo serve as duas.
 */

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SpinnerIcon, SwapIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface EnrollmentConflict {
  studentName: string;
  fromGroupName: string;
  toGroupName: string;
}

interface EnrollmentConflictDialogProps {
  conflict: EnrollmentConflict | null;
  tone?: "admin" | "app";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EnrollmentConflictDialog({
  conflict,
  tone = "admin",
  busy = false,
  onConfirm,
  onCancel,
}: EnrollmentConflictDialogProps) {
  useEffect(() => {
    if (!conflict) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [conflict, busy, onCancel]);

  const admin = tone === "admin";

  return (
    <AnimatePresence>
      {conflict && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !busy && onCancel()}
            className="absolute inset-0 bg-navy-950/55 backdrop-blur-sm"
          />

          <Panel
            admin={admin}
            busy={busy}
            conflict={conflict}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        </div>
      )}
    </AnimatePresence>
  );
}

function Panel({
  admin,
  busy,
  conflict,
  onCancel,
  onConfirm,
}: {
  admin: boolean;
  busy: boolean;
  conflict: EnrollmentConflict;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="conflito-turma-titulo"
      aria-describedby="conflito-turma-texto"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn(
        "relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl",
        admin ? "border-admin-border bg-admin-surface" : "border-border bg-background",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
            admin ? "bg-gold-100 text-gold-700" : "bg-muted text-navy-700",
          )}
        >
          <SwapIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2
            id="conflito-turma-titulo"
            className={cn(
              "text-base font-semibold",
              admin ? "text-admin-foreground" : "text-navy-900",
            )}
          >
            Este aluno já tem turma
          </h2>
          <p
            id="conflito-turma-texto"
            className={cn(
              "mt-1.5 text-sm leading-relaxed",
              admin ? "text-admin-foreground/65" : "text-muted-foreground",
            )}
          >
            <strong className={admin ? "text-admin-foreground" : "text-navy-900"}>
              {conflict.studentName}
            </strong>{" "}
            está matriculado em <strong>{conflict.fromGroupName}</strong>. Um aluno só pode
            estar em uma turma por vez — continuar move a matrícula para{" "}
            <strong>{conflict.toGroupName}</strong> e encerra a anterior.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={cn(
            "rounded-xl border px-3.5 py-2 text-sm transition-colors disabled:opacity-50",
            admin
              ? "border-admin-border text-admin-foreground/70 hover:bg-admin-muted"
              : "border-border text-navy-700 hover:bg-muted",
          )}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-opacity hover:opacity-95 disabled:opacity-50",
            admin
              ? "bg-gradient-to-r from-gold-600 to-gold-400 text-admin-foreground"
              : "bg-navy-900 text-white",
          )}
        >
          {busy && <SpinnerIcon className="h-4 w-4 animate-spin" />}
          {busy ? "Movendo…" : "Mover para esta turma"}
        </button>
      </div>
    </motion.div>
  );
}
