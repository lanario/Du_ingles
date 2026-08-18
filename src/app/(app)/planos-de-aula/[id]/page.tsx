import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getLessonPlanById } from "@/repositories/lesson-plans";
import { LessonPlanMetaForm } from "@/components/features/lesson-plans/lesson-plan-meta-form";
import { LessonPlanContentEditor } from "@/components/features/lesson-plans/lesson-plan-content-editor";
import { LessonPlanActions } from "@/components/features/lesson-plans/lesson-plan-actions";

export const metadata: Metadata = { title: "Plano de aula" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlanoDeAulaPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["teacher"]);
  const plan = await getLessonPlanById(id, ctx.userId);
  if (!plan) notFound();

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-6">
        <LessonPlanMetaForm plan={plan} />
        <LessonPlanActions planId={plan.id} isOwn={plan.isOwn} />
      </aside>
      <div>
        <LessonPlanContentEditor
          planId={plan.id}
          initialContent={plan.content}
          editable={plan.isOwn}
        />
      </div>
    </div>
  );
}
