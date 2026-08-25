import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import {
  getAssignmentAnswerKey,
  getAssignmentSubmissions,
  getOrgAssignmentById,
} from "@/repositories/assignments";
import { SubmissionReview } from "@/components/features/assignments/submission-review";
import { ArrowLeftIcon, CalendarIcon, TaskIcon } from "@/components/ui/icons";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requireRole(["admin"]);
  const assignment = await getOrgAssignmentById(id, ctx.organizationId);
  return { title: assignment ? `${assignment.title} · Tarefa` : "Tarefa" };
}

/** Correção da tarefa pelo admin, a partir do planejador. */
export default async function AdminTarefaPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["admin"]);

  // Como no plano de aula: `getOrgAssignmentById` roda com service-role e
  // filtra por organização — é esse filtro que autoriza a página, e por isso
  // ele vem antes das leituras de gabarito e de entregas.
  const assignment = await getOrgAssignmentById(id, ctx.organizationId);
  if (!assignment) notFound();

  const [submissions, answerKey] = await Promise.all([
    getAssignmentSubmissions(id),
    getAssignmentAnswerKey(id),
  ]);

  const delivered = submissions.filter((s) => s.status !== "pending").length;
  const pendingReview = submissions.filter(
    (s) => s.status !== "pending" && s.status !== "graded",
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <header>
        <Link
          href="/admin/planejador"
          className="inline-flex items-center gap-1.5 text-sm text-admin-foreground/60 transition-colors hover:text-admin-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Planejador
        </Link>

        <p className="mt-4 text-sm font-medium uppercase tracking-wide text-gold-600">
          {assignment.groupName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-admin-foreground">
          {assignment.title}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-admin-foreground/60">
          {assignment.questions.length > 0 && (
            <span className="flex items-center gap-1.5">
              <TaskIcon className="h-4 w-4" />
              {assignment.questions.length} quest
              {assignment.questions.length === 1 ? "ão" : "ões"}
            </span>
          )}
          {assignment.maxScore != null && <span>Nota máxima: {assignment.maxScore}</span>}
          {assignment.dueAt && (
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              Prazo: {new Date(assignment.dueAt).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>

        {assignment.instructions && (
          <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-admin-border bg-admin-background p-4 text-sm leading-relaxed text-admin-foreground/80">
            {assignment.instructions}
          </p>
        )}
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-admin-foreground/55">
          {delivered} entrega{delivered === 1 ? "" : "s"}
          {pendingReview > 0 && ` · ${pendingReview} para corrigir`}
        </h2>

        <SubmissionReview
          assignmentId={id}
          questions={assignment.questions}
          answerKey={answerKey}
          maxScore={assignment.maxScore}
          submissions={submissions}
          variant="admin"
        />
      </section>
    </div>
  );
}
