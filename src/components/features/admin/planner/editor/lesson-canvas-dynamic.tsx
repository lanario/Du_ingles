"use client";

import dynamic from "next/dynamic";
import { LoadingVeil } from "@/components/ui/logo-loader";

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
      <div className="relative min-h-[520px] rounded-2xl border border-admin-border bg-admin-surface">
        <LoadingVeil label="Abrindo o editor…" size={72} className="rounded-2xl" />
      </div>
    ),
  },
);
