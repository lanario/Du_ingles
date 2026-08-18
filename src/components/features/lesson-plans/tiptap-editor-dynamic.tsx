"use client";

import dynamic from "next/dynamic";

/** Tiptap só entra no bundle de quem edita conteúdo — nunca no da landing
 * page nem no de quem só lê (§8.3). */
export const TiptapEditor = dynamic(
  () =>
    import("@/components/features/lesson-plans/tiptap-editor").then(
      (m) => m.TiptapEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[440px] animate-pulse rounded-md border border-border bg-muted" />
    ),
  },
);
