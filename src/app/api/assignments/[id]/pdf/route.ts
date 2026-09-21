import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext, isAdmin } from "@/lib/auth/session";
import {
  getAssignmentAnswerKey,
  getAssignmentById,
  getMySubmission,
  getOrgAssignmentById,
} from "@/repositories/assignments";
import { isGroupOwnedByTeacher } from "@/repositories/groups";
import { formatDueDate } from "@/lib/assignments/due-date";
import {
  assignmentPdfResponse,
  groupTeacherName,
  schoolNameOf,
  todayLabel,
} from "@/lib/pdf/assignment-pdf";

// react-pdf usa APIs de Node (Buffer, fontkit) — não roda no Edge Runtime.
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Folha de exercícios de uma tarefa já atribuída a uma turma.
 *
 * Autorização, na mesma ordem das páginas da tarefa:
 * - aluno: RLS de `assignments` (`getAssignmentById`) — só a da turma dele;
 * - professor: escola + turma ser dele;
 * - admin: escola.
 *
 * `?gabarito=1` só vale para staff, e o gabarito (service-role) só é lido
 * DEPOIS de a posse ter sido provada.
 *
 * Preenchimento: turma, professor e data (o prazo de entrega) sempre; o nome
 * do aluno só quando é ele quem baixa — a folha do professor sai em branco
 * para ser impressa para a turma. A nota só aparece para o aluno, e só depois
 * de a entrega dele ter sido corrigida.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const staff = isAdmin(ctx) || ctx.realRole === "teacher";

  let assignment;
  if (isAdmin(ctx)) {
    assignment = await getOrgAssignmentById(id, ctx.organizationId);
  } else if (ctx.realRole === "teacher") {
    assignment = await getOrgAssignmentById(id, ctx.organizationId);
    if (assignment && !(await isGroupOwnedByTeacher(assignment.groupId, ctx.userId))) {
      assignment = null;
    }
  } else {
    assignment = await getAssignmentById(id);
  }

  if (!assignment) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  const wantsKey = request.nextUrl.searchParams.get("gabarito") === "1";
  const [answerKey, schoolName, teacherName, mine] = await Promise.all([
    staff && wantsKey ? getAssignmentAnswerKey(id) : undefined,
    schoolNameOf(ctx.organizationId),
    groupTeacherName(assignment.groupId),
    staff ? null : getMySubmission(id, ctx.userId),
  ]);

  const grade =
    mine?.status === "graded" && mine.score != null
      ? { score: mine.score, maxScore: assignment.maxScore }
      : null;

  return assignmentPdfResponse({
    schoolName,
    title: assignment.title,
    groupName: assignment.groupName,
    teacherName,
    studentName: staff ? null : ctx.fullName,
    dateLabel: assignment.dueAt ? formatDueDate(assignment.dueAt) : todayLabel(),
    instructions: assignment.instructions,
    questions: assignment.questions,
    grade,
    answerKey,
  });
}
