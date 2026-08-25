"use client";

import dynamic from "next/dynamic";
import { LoadingVeil } from "@/components/ui/logo-loader";

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
      <div className="relative min-h-[440px] rounded-md border border-border bg-background">
        <LoadingVeil label="Abrindo o editor…" size={72} className="rounded-md" />
      </div>
    ),
  },
);
