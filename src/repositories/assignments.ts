import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AssignmentStatus } from "@/types/domain";
import type { Json } from "@/types/database.types";
import {
  autoGrade,
  isObjective,
  readAnswerKey,
  readAnswers,
  readInstructionsText,
  readQuestions,
  type AnswerKey,
  type Question,
  type StudentAnswers,
} from "@/lib/assignments/exercises";
import type { QuestionDraft } from "@/schemas/assignments";

export interface AssignmentListItem {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  dueAt: string | null;
  maxScore: number | null;
  myStatus?: AssignmentStatus | null;
  myScore?: number | null;
  /** 0 = tarefa só de instruções, sem exercício digital. */
  questionCount?: number;
}

export interface SubmissionRow {
  studentId: string;
  studentName: string;
  content: string | null;
  answers: StudentAnswers;
  status: AssignmentStatus;
  score: number | null;
  feedback: string | null;
  submittedAt: string | null;
  /** Prévia da correção automática — só chega em quem corrige, nunca no aluno. */
  autoScore: number | null;
  autoMax: number | null;
}

/**
 * "Atrasada" não é um estado gravado: nada roda no vencimento do prazo para
 * virar a linha de `pending` para `late`. É o prazo comparado com agora, e é
 * derivado na leitura para que a lista do aluno nunca minta sobre o que já
 * venceu.
 */
function derivedStatus(
  status: AssignmentStatus | null | undefined,
  dueAt: string | null,
): AssignmentStatus {
  const current = status ?? "pending";
  if (current !== "pending" || !dueAt) return current;
  return new Date(dueAt) < new Date() ? "late" : "pending";
}

/** Turma → visão do professor (todas as tarefas que ele criou). */
export async function listGroupAssignments(
  groupId: string,
): Promise<AssignmentListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("id, group_id, title, instructions, due_at, max_score, group:group_id(name)")
    .eq("group_id", groupId)
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    groupName: row.group?.name ?? "—",
    title: row.title,
    dueAt: row.due_at,
    maxScore: row.max_score,
    questionCount: readQuestions(row.instructions).length,
  }));
}

/** Aluno → todas as tarefas das turmas em que está matriculado, com o status da própria submissão. */
export async function listStudentAssignments(
  studentId: string,
): Promise<AssignmentListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, group_id, title, instructions, due_at, max_score, group:group_id(name), submissions:assignment_submissions(status, score, student_id)",
    )
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error || !data) return [];

  return data.map((row) => {
    const mine = row.submissions?.find((s) => s.student_id === studentId);
    return {
      id: row.id,
      groupId: row.group_id,
      groupName: row.group?.name ?? "—",
      title: row.title,
      dueAt: row.due_at,
      maxScore: row.max_score,
      myStatus: derivedStatus(mine?.status, row.due_at),
      myScore: mine?.score ?? null,
      questionCount: readQuestions(row.instructions).length,
    };
  });
}

export interface AssignmentDetail {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  instructions: string | null;
  questions: Question[];
  dueAt: string | null;
  maxScore: number | null;
}

/** RLS (`assignments_select_teacher` / `assignments_select_student`) é a
 * única autorização aqui: se a linha voltar, quem chamou pode vê-la.
 *
 * Devolve só o que o aluno pode ver — `answer_key` sequer é selecionável por
 * `authenticated` (0030), então o gabarito não vaza nem por descuido de quem
 * escrever a próxima tela. Para corrigir, use `getAssignmentAnswerKey`. */
export async function getAssignmentById(id: string): Promise<AssignmentDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("id, group_id, title, instructions, due_at, max_score, group:group_id(name)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    groupId: data.group_id,
    groupName: data.group?.name ?? "—",
    title: data.title,
    instructions: readInstructionsText(data.instructions),
    questions: readQuestions(data.instructions),
    dueAt: data.due_at,
    maxScore: data.max_score,
  };
}

/**
 * Gabarito — service-role, porque `answer_key` está fora do SELECT de
 * `authenticated`. Quem chama PRECISA ter confirmado antes que o usuário
 * pode corrigir esta tarefa (professor dono da turma ou admin da escola);
 * esta função não checa nada.
 */
export async function getAssignmentAnswerKey(assignmentId: string): Promise<AnswerKey> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("assignments")
    .select("answer_key")
    .eq("id", assignmentId)
    .maybeSingle();
  return readAnswerKey(data?.answer_key ?? null);
}

/** Versão admin de `getAssignmentById`, para o planejador (a escola vê tudo). */
export async function getOrgAssignmentById(
  id: string,
  organizationId: string,
): Promise<AssignmentDetail | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("assignments")
    .select("id, group_id, title, instructions, due_at, max_score, group:group_id(name)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    groupId: data.group_id,
    groupName: data.group?.name ?? "—",
    title: data.title,
    instructions: readInstructionsText(data.instructions),
    questions: readQuestions(data.instructions),
    dueAt: data.due_at,
    maxScore: data.max_score,
  };
}

/**
 * Entregas para quem corrige. Usa service-role porque traz `auto_score` /
 * `auto_max`, invisíveis a `authenticated` (0030) — mesma regra da função do
 * gabarito: a autorização é responsabilidade de quem chama.
 */
export async function getAssignmentSubmissions(
  assignmentId: string,
): Promise<SubmissionRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("assignment_submissions")
    .select(
      "student_id, content, answers, status, score, feedback, submitted_at, auto_score, auto_max, student:student_id(full_name)",
    )
    .eq("assignment_id", assignmentId);

  if (error || !data) return [];
  return data.map((row) => ({
    studentId: row.student_id,
    studentName: row.student?.full_name ?? "—",
    content: row.content,
    answers: readAnswers(row.answers),
    status: row.status,
    score: row.score,
    feedback: row.feedback,
    submittedAt: row.submitted_at,
    autoScore: row.auto_score,
    autoMax: row.auto_max,
  }));
}

export interface MySubmission {
  content: string | null;
  answers: StudentAnswers;
  status: AssignmentStatus;
  score: number | null;
  feedback: string | null;
  submittedAt: string | null;
}

/**
 * A entrega do próprio aluno, pelo client normal — `submissions_select_own`
 * garante que só a linha dele volta, e as colunas de correção automática nem
 * existem para este papel.
 */
export async function getMySubmission(
  assignmentId: string,
  studentId: string,
): Promise<MySubmission | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("assignment_submissions")
    .select("content, answers, status, score, feedback, submitted_at")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!data) return null;
  return {
    content: data.content,
    answers: readAnswers(data.answers),
    status: data.status,
    score: data.score,
    feedback: data.feedback,
    submittedAt: data.submitted_at,
  };
}

export async function createAssignment(input: {
  groupId: string;
  title: string;
  dueAt?: string;
  maxScore: number;
  organizationId: string;
  createdBy: string;
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("assignments").insert({
    organization_id: input.organizationId,
    group_id: input.groupId,
    title: input.title,
    due_at: input.dueAt ?? null,
    max_score: input.maxScore,
    created_by: input.createdBy,
  });
  return !error;
}

export interface PlannerAssignmentListItem {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  maxScore: number | null;
  createdAt: string;
  submissionCount: number;
  questionCount: number;
  /** Entregas ainda sem nota fechada — o que o professor tem para corrigir. */
  pendingReviewCount: number;
}

/**
 * Visão do admin no planejador: tarefas da escola inteira. Como `assignments`
 * guarda uma turma por linha, uma tarefa "enviada para 3 turmas" aparece como
 * 3 linhas com o mesmo título — o mesmo padrão que `class_sessions` já usa
 * para uma aula agendada em turmas diferentes.
 */
export async function listOrgAssignments(
  organizationId: string,
): Promise<PlannerAssignmentListItem[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("assignments")
    .select(
      "id, group_id, title, instructions, due_at, max_score, created_at, group:group_id(name), submissions:assignment_submissions(status)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error || !data) return [];
  return data.map((row) => {
    const submissions = row.submissions ?? [];
    return {
      id: row.id,
      groupId: row.group_id,
      groupName: row.group?.name ?? "—",
      title: row.title,
      instructions: readInstructionsText(row.instructions),
      dueAt: row.due_at,
      maxScore: row.max_score,
      createdAt: row.created_at,
      submissionCount: submissions.length,
      questionCount: readQuestions(row.instructions).length,
      pendingReviewCount: submissions.filter((s) => s.status !== "graded").length,
    };
  });
}

/**
 * Separa o rascunho do professor nas duas colunas que o banco espera: o
 * enunciado vai para `instructions.questions` (o aluno lê) e o gabarito para
 * `answer_key` (o aluno não alcança). Dissertativa não entra no gabarito —
 * é justamente o que sobra para o professor corrigir na mão.
 */
export function splitQuestionDrafts(drafts: QuestionDraft[]): {
  questions: Question[];
  answerKey: AnswerKey;
} {
  const questions: Question[] = [];
  const answerKey: AnswerKey = {};

  for (const draft of drafts) {
    if (draft.type === "multiple_choice") {
      questions.push({
        id: draft.id,
        type: draft.type,
        prompt: draft.prompt,
        options: draft.options,
        points: draft.points,
      });
      answerKey[draft.id] = { type: "multiple_choice", correct: draft.correct };
      continue;
    }

    questions.push({
      id: draft.id,
      type: draft.type,
      prompt: draft.prompt,
      points: draft.points,
    });

    if (draft.type === "true_false") {
      answerKey[draft.id] = { type: "true_false", correct: draft.correct };
    } else if (draft.type === "fill_blank") {
      answerKey[draft.id] = { type: "fill_blank", accepted: draft.accepted };
    }
  }

  return { questions, answerKey };
}

/** Uma linha em `assignments` por turma selecionada — ver nota acima. */
export async function createAssignmentsForGroups(input: {
  groupIds: string[];
  title: string;
  instructions?: string;
  questions?: QuestionDraft[];
  dueAt?: string;
  maxScore: number;
  organizationId: string;
  createdBy: string;
}): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { questions, answerKey } = splitQuestionDrafts(input.questions ?? []);

  const instructions =
    input.instructions || questions.length > 0
      ? ({
          ...(input.instructions ? { text: input.instructions } : {}),
          ...(questions.length > 0 ? { questions } : {}),
        } as unknown as Json)
      : null;

  const { error } = await admin.from("assignments").insert(
    input.groupIds.map((groupId) => ({
      organization_id: input.organizationId,
      group_id: groupId,
      title: input.title,
      instructions,
      answer_key: Object.keys(answerKey).length > 0 ? (answerKey as unknown as Json) : null,
      due_at: input.dueAt ?? null,
      max_score: input.maxScore,
      created_by: input.createdBy,
    })),
  );
  return !error;
}

export async function deletePlannerAssignment(
  id: string,
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("assignments")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  return !error;
}

/**
 * Grava a entrega do aluno com o client normal (RLS `submissions_insert_own` /
 * `submissions_update_own_pending` decide se ele pode).
 *
 * Por que não é um `upsert`: o upsert do PostgREST vira `ON CONFLICT DO UPDATE
 * SET` com TODAS as colunas do payload, e `organization_id`/`assignment_id`/
 * `student_id` não têm UPDATE liberado para `authenticated` — de propósito, é o
 * que impede o aluno de mudar sua entrega de tarefa. Resultado: o upsert
 * funcionava na primeira gravação (INSERT) e tomava "permission denied" em
 * todas as seguintes. Então: UPDATE só das colunas mutáveis e, se não existir
 * linha ainda, INSERT.
 */
async function writeSubmission(input: {
  assignmentId: string;
  studentId: string;
  organizationId: string;
  patch: {
    content: string;
    status: "pending" | "submitted";
    submitted_at: string | null;
    answers?: Json;
  };
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  const { data: updated, error: updateError } = await supabase
    .from("assignment_submissions")
    .update(input.patch)
    .eq("assignment_id", input.assignmentId)
    .eq("student_id", input.studentId)
    .select("assignment_id");

  if (updateError) return false;
  if (updated && updated.length > 0) return true;

  const { error: insertError } = await supabase.from("assignment_submissions").insert({
    organization_id: input.organizationId,
    assignment_id: input.assignmentId,
    student_id: input.studentId,
    ...input.patch,
  });
  return !insertError;
}

export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  organizationId: string,
  content: string,
): Promise<boolean> {
  return writeSubmission({
    assignmentId,
    studentId,
    organizationId,
    patch: {
      content,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    },
  });
}

/**
 * Grava as respostas do exercício — rascunho ou envio definitivo.
 *
 * Depois de corrigida (`graded`), `submissions_update_own_pending` deixa de
 * casar e a escrita falha: é o comportamento desejado, tarefa corrigida não
 * volta a ser editável.
 *
 * `content` recebe a versão em texto das respostas para que as telas que só
 * conhecem texto (export LGPD, correção do professor de turma) continuem
 * mostrando algo legível.
 */
export async function saveAnswers(input: {
  assignmentId: string;
  studentId: string;
  organizationId: string;
  answers: StudentAnswers;
  content: string;
  draft: boolean;
}): Promise<boolean> {
  return writeSubmission({
    assignmentId: input.assignmentId,
    studentId: input.studentId,
    organizationId: input.organizationId,
    patch: {
      answers: input.answers as unknown as Json,
      content: input.content,
      status: input.draft ? "pending" : "submitted",
      submitted_at: input.draft ? null : new Date().toISOString(),
    },
  });
}

/**
 * Corrige as objetivas e guarda o resultado em `auto_score`/`auto_max`, que só
 * quem corrige enxerga. Roda com service-role tanto porque essas colunas são
 * negadas a `authenticated` quanto porque precisa do gabarito — se o aluno
 * pudesse disparar a leitura do gabarito, o resto da proteção não valeria nada.
 *
 * Nunca mexe em `score`: a nota do aluno continua sendo um ato do professor.
 */
export async function storeAutoGrade(
  assignmentId: string,
  studentId: string,
  answers: StudentAnswers,
): Promise<void> {
  const admin = createAdminSupabaseClient();

  const { data } = await admin
    .from("assignments")
    .select("instructions, answer_key")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!data) return;

  const questions = readQuestions(data.instructions);
  const objectives = questions.filter((q) => isObjective(q.type));
  if (objectives.length === 0) return;

  const result = autoGrade(questions, readAnswerKey(data.answer_key), answers);

  await admin
    .from("assignment_submissions")
    .update({ auto_score: result.score, auto_max: result.max })
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId);
}

/** score/feedback/graded_at/graded_by têm UPDATE revogado de `authenticated`
 * (migration 0022, aluno não pode se auto-avaliar) — client normal não
 * consegue gravar a nota nem para o professor dono da turma. */
export async function gradeSubmission(
  assignmentId: string,
  studentId: string,
  gradedBy: string,
  score: number,
  feedback: string | undefined,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("assignment_submissions")
    .update({
      score,
      feedback: feedback ?? null,
      status: "graded",
      graded_at: new Date().toISOString(),
      graded_by: gradedBy,
    })
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId);
  return !error;
}
