"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  duplicateLessonPlanAction,
  deleteLessonPlanAction,
} from "@/actions/teacher/lesson-plans";

export function LessonPlanActions({ planId, isOwn }: { planId: string; isOwn: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await duplicateLessonPlanAction(planId);
          })
        }
        className="min-h-11 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted sm:min-h-0 disabled:opacity-50"
      >
        Duplicar
      </button>
      {isOwn && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Excluir este plano de aula?")) return;
            startTransition(async () => {
              await deleteLessonPlanAction(planId);
              router.push("/planos-de-aula");
            });
          }}
          className="min-h-11 rounded-md border border-destructive/40 px-3 py-1.5 text-sm sm:min-h-0 text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          Excluir
        </button>
      )}
    </div>
  );
}
