"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarIcon, LibraryIcon } from "@/components/ui/icons";
import { DownloadPdfButton } from "@/components/features/library/download-pdf-button";
import type { LibraryEntry } from "@/repositories/library";

export function LibraryGrid({ entries }: { entries: LibraryEntry[] }) {
  const reduceMotion = useReducedMotion();

  if (entries.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
        <p className="font-medium text-navy-900">Nenhuma aula publicada ainda.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O material aparece aqui assim que uma aula é encerrada.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry, index) => (
        <motion.li
          key={entry.id}
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.28), ease: "easeOut" }}
          whileHover={reduceMotion ? undefined : { y: -3 }}
          className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
            <LibraryIcon className="h-5 w-5" />
          </span>
          <p className="mt-3 font-medium text-navy-900">{entry.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="truncate">{entry.groupName}</span>
            <span aria-hidden="true">·</span>
            <span className="flex flex-none items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              {new Date(entry.scheduledAt).toLocaleDateString("pt-BR")}
            </span>
          </p>
          <div className="mt-3 border-t border-border pt-3">
            <DownloadPdfButton sessionId={entry.id} hasPdf={entry.hasPdf} />
          </div>
        </motion.li>
      ))}
    </ul>
  );
}
