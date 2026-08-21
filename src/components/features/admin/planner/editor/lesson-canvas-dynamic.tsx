"use client";

import dynamic from "next/dynamic";

/**
 * O Tiptap (e o ProseMirror atrás dele) só entra no bundle de quem abre um
 * canvas — nunca no da lista de planos nem no da agenda.
 */
export const LessonCanvas = dynamic(
  () =>
    import("@/components/features/admin/planner/editor/lesson-canvas").then(
      (module) => module.LessonCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[520px] animate-pulse rounded-2xl border border-admin-border bg-admin-muted" />
    ),
  },
);
