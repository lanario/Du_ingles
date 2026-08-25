import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface EnrollmentListItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentAvatarUrl: string | null;
  status: string;
}

/**
 * Onde o aluno está agora. A regra da escola é uma turma por aluno, então
 * esta é a única matrícula ativa que pode existir — o índice parcial
 * `enrollments_one_active_per_student` (migration 0028) garante isso no banco,
 * e as funções abaixo consultam esta referência antes de qualquer matrícula.
 */
export interface ActiveEnrollmentRef {
  enrollmentId: string;
  groupId: string;
  groupName: string;
}

export async function listGroupEnrollments(
  groupId: string,
): Promise<EnrollmentListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status, student:student_id(id, full_name, email, avatar_url)")
    .eq("group_id", groupId)
    .order("enrolled_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    studentId: row.student?.id ?? "",
    studentName: row.student?.full_name ?? "—",
    studentEmail: row.student?.email ?? "",
    studentAvatarUrl: row.student?.avatar_url ? `/api/avatars/${row.student.avatar_url}` : null,
    status: row.status,
  }));
}

/**
 * A matrícula ativa do aluno, se houver. Ordena e limita a uma linha em vez
 * de `.single()`: bases criadas antes do índice único podem ter duplicatas, e
 * aqui a mais recente é a que vale.
 */
export async function getActiveEnrollmentForStudent(
  studentId: string,
): Promise<ActiveEnrollmentRef | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("enrollments")
    .select("id, group_id, group:group_id(name)")
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("enrolled_at", { ascending: false })
    .limit(1);

  const row = data?.[0];
  if (!row) return null;

  return {
    enrollmentId: row.id,
    groupId: row.group_id,
    groupName: row.group?.name ?? "outra turma",
  };
}

/**
 * Mapa aluno → turma atual da organização inteira. As telas de matrícula usam
 * isso para avisar **antes** de submeter que o aluno escolhido já está em
 * outra turma (o servidor recusa de qualquer jeito, mas o aviso na tela é o
 * que evita a tentativa às cegas).
 */
export async function listActiveEnrollmentRefs(
  organizationId: string,
): Promise<Record<string, ActiveEnrollmentRef>> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("enrollments")
    .select("id, student_id, group_id, group:group_id(name)")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  const byStudent: Record<string, ActiveEnrollmentRef> = {};
  for (const row of data ?? []) {
    byStudent[row.student_id] = {
      enrollmentId: row.id,
      groupId: row.group_id,
      groupName: row.group?.name ?? "outra turma",
    };
  }
  return byStudent;
}

export interface EnrollResult {
  success: boolean;
  message?: string;
  /** Turma onde o aluno já está — só vem preenchido quando o conflito barrou. */
  conflictGroupName?: string;
  /** `true` quando a matrícula anterior foi movida, e não criada do zero. */
  transferred?: boolean;
}

/**
 * Matricula o aluno. Um aluno pertence a **uma** turma: se já houver matrícula
 * ativa em outra, matricular vira transferência — e só acontece com
 * `allowTransfer`, que a UI passa depois de o usuário confirmar no diálogo.
 * Sem confirmação, devolve o conflito com o nome da turma atual.
 */
export async function enrollStudent(
  groupId: string,
  studentId: string,
  organizationId: string,
  options: { allowTransfer?: boolean } = {},
): Promise<EnrollResult> {
  const current = await getActiveEnrollmentForStudent(studentId);

  if (current) {
    if (current.groupId === groupId)
      return { success: false, message: "Aluno já matriculado nesta turma." };

    if (!options.allowTransfer)
      return {
        success: false,
        conflictGroupName: current.groupName,
        message: `Este aluno já está na turma ${current.groupName}. Um aluno só pode estar em uma turma por vez.`,
      };

    const moved = await transferStudent(current.enrollmentId, groupId);
    return moved.success
      ? { success: true, transferred: true }
      : { success: false, message: moved.message };
  }

  return activateEnrollment(groupId, studentId, organizationId);
}

/**
 * Põe o aluno como ativo na turma reaproveitando a linha antiga quando ela
 * existe. Sem isso, rematricular alguém que já passou pela turma esbarra na
 * unicidade `(group_id, student_id)` e volta como "falha ao matricular".
 */
async function activateEnrollment(
  groupId: string,
  studentId: string,
  organizationId: string,
): Promise<EnrollResult> {
  const admin = createAdminSupabaseClient();

  const { data: existing } = await admin
    .from("enrollments")
    .select("id")
    .eq("group_id", groupId)
    .eq("student_id", studentId)
    .limit(1);

  const previous = existing?.[0];
  if (previous) {
    const { error } = await admin
      .from("enrollments")
      .update({ status: "active", enrolled_at: new Date().toISOString() })
      .eq("id", previous.id);
    return error
      ? { success: false, message: "Falha ao matricular." }
      : { success: true };
  }

  const { error } = await admin.from("enrollments").insert({
    organization_id: organizationId,
    group_id: groupId,
    student_id: studentId,
  });
  if (error) {
    return {
      success: false,
      message:
        error.code === "23505"
          ? "Este aluno já está matriculado em outra turma."
          : "Falha ao matricular.",
    };
  }
  return { success: true };
}

/**
 * Todas as listas de uma vez (`in`) — a tela de Turmas do professor mostra
 * N turmas com N chamadas seria N+1 (§10.1).
 */
export async function listEnrollmentsForGroups(
  groupIds: string[],
): Promise<Record<string, EnrollmentListItem[]>> {
  if (groupIds.length === 0) return {};

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status, group_id, student:student_id(id, full_name, email, avatar_url)")
    .in("group_id", groupIds)
    .order("enrolled_at", { ascending: false });

  if (error || !data) return {};

  const byGroup: Record<string, EnrollmentListItem[]> = {};
  for (const row of data) {
    (byGroup[row.group_id] ??= []).push({
      id: row.id,
      studentId: row.student?.id ?? "",
      studentName: row.student?.full_name ?? "—",
      studentEmail: row.student?.email ?? "",
      studentAvatarUrl: row.student?.avatar_url ? `/api/avatars/${row.student.avatar_url}` : null,
      status: row.status,
    });
  }
  return byGroup;
}

export interface StudentEnrollmentItem {
  id: string;
  groupId: string;
  status: string;
  enrolledAt: string;
}

/** Matrículas do aluno logado — passa pela RLS `enrollments_select_self`. */
export async function listStudentEnrollments(
  studentId: string,
): Promise<StudentEnrollmentItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, group_id, status, enrolled_at")
    .eq("student_id", studentId)
    .order("enrolled_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    status: row.status,
    enrolledAt: row.enrolled_at,
  }));
}

export interface ClassmateItem {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Colegas de turma — só nome e foto, nunca e-mail ou id de matrícula: a tela
 * do aluno é de leitura e não precisa identificar ninguém além do rosto.
 *
 * Usa o client admin porque a RLS `enrollments_select_self` limita o aluno às
 * próprias matrículas; a autorização fica no chamador, que só pede as turmas
 * em que o próprio aluno está matriculado.
 */
export async function listGroupClassmates(
  groupIds: string[],
): Promise<Record<string, ClassmateItem[]>> {
  if (groupIds.length === 0) return {};

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("enrollments")
    .select("group_id, student:student_id(id, full_name, avatar_url)")
    .in("group_id", groupIds)
    .eq("status", "active");

  if (error || !data) return {};

  const byGroup: Record<string, ClassmateItem[]> = {};
  for (const row of data) {
    if (!row.student) continue;
    (byGroup[row.group_id] ??= []).push({
      id: row.student.id,
      name: row.student.full_name ?? "—",
      avatarUrl: row.student.avatar_url ? `/api/avatars/${row.student.avatar_url}` : null,
    });
  }
  for (const list of Object.values(byGroup)) {
    list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  return byGroup;
}

/**
 * Move uma matrícula para outra turma. As checagens de lotação e de duplicata
 * ficam aqui (e não só no formulário) porque a Server Action é a fronteira
 * real de confiança — o cliente pode mandar qualquer par de ids.
 */
export async function transferStudent(
  enrollmentId: string,
  toGroupId: string,
): Promise<{ success: boolean; message?: string; studentId?: string }> {
  const admin = createAdminSupabaseClient();

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id, student_id, group_id, status")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) return { success: false, message: "Matrícula não encontrada." };
  if (enrollment.group_id === toGroupId)
    return { success: false, message: "O aluno já está nesta turma." };
  if (enrollment.status !== "active")
    return { success: false, message: "Só matrículas ativas podem ser transferidas." };

  const { data: target } = await admin
    .from("groups")
    .select("id, max_students, is_active")
    .eq("id", toGroupId)
    .single();

  if (!target) return { success: false, message: "Turma de destino não encontrada." };
  if (!target.is_active)
    return { success: false, message: "A turma de destino está inativa." };

  const { count } = await admin
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("group_id", toGroupId)
    .eq("status", "active");

  if ((count ?? 0) >= target.max_students)
    return { success: false, message: "A turma de destino está lotada." };

  // O aluno já passou por esta turma antes: a linha antiga ocupa o par
  // `(group_id, student_id)`, então reativa aquela e encerra a atual — mover
  // esta por cima esbarraria na unicidade.
  const { data: previous } = await admin
    .from("enrollments")
    .select("id")
    .eq("group_id", toGroupId)
    .eq("student_id", enrollment.student_id)
    .limit(1);

  if (previous?.[0]) {
    const { error: cancelError } = await admin
      .from("enrollments")
      .update({ status: "cancelled" })
      .eq("id", enrollmentId);
    if (cancelError) return { success: false, message: "Falha ao transferir." };

    const { error: activateError } = await admin
      .from("enrollments")
      .update({ status: "active", enrolled_at: new Date().toISOString() })
      .eq("id", previous[0].id);
    if (activateError) return { success: false, message: "Falha ao transferir." };

    return { success: true, studentId: enrollment.student_id };
  }

  const { error } = await admin
    .from("enrollments")
    .update({ group_id: toGroupId })
    .eq("id", enrollmentId);

  if (error) {
    return {
      success: false,
      message:
        error.code === "23505"
          ? "O aluno já tem matrícula nesta turma."
          : "Falha ao transferir.",
    };
  }

  return { success: true, studentId: enrollment.student_id };
}

export async function unenrollStudent(enrollmentId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("enrollments")
    .update({ status: "cancelled" })
    .eq("id", enrollmentId);
  return !error;
}

/**
 * O aluno está matriculado em alguma turma deste professor? É o recorte de
 * "meus alunos" na área do professor: ele lê a ficha de quem ele leciona, e
 * de mais ninguém da escola.
 */
export async function isStudentOfTeacher(
  studentId: string,
  teacherId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("enrollments")
    .select("id, group:group_id!inner(teacher_id)")
    .eq("student_id", studentId)
    .eq("status", "active")
    .eq("group.teacher_id", teacherId)
    .limit(1);
  return (data ?? []).length > 0;
}
