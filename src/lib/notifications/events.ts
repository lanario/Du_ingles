import "server-only";
import { after } from "next/server";
import { ADMIN_BASE, TEACHER_BASE } from "@/lib/areas";
import * as audience from "@/lib/notifications/audience";
import { dispatchNotifications, type Recipient } from "@/lib/notifications/dispatch";
import type { AppRole, AttendanceStatus } from "@/types/domain";

/**
 * Catálogo de eventos do sino.
 *
 * Uma função por acontecimento do domínio. Cada uma resolve o público a
 * partir do papel de quem recebe — o aluno é avisado do que muda na aula e na
 * tarefa dele; o professor, do que acontece nas turmas dele; a coordenação,
 * do que precisa de arbitragem ou tem efeito administrativo. Quem agiu nunca
 * recebe o aviso do próprio ato, e `dispatchNotifications` deduplica quem
 * aparece em dois públicos do mesmo evento.
 *
 * Todas devolvem `void` e são disparadas com `after()`: gravar notificação não
 * pode atrasar a resposta de quem acabou de salvar, e uma falha aqui não
 * desfaz a escrita de domínio que já aconteceu.
 */

const TZ = "America/Sao_Paulo";

/**
 * Roda depois da resposta. Fora de um request (script, teste) `after` lança —
 * nesse caso o trabalho vai direto, ainda sem poder derrubar quem chamou.
 */
function schedule(task: () => Promise<unknown>): void {
  const guarded = async () => {
    try {
      await task();
    } catch (error) {
      console.error("[notifications] falha ao montar o aviso:", error);
    }
  };
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

/* ------------------------------------------------------------------ links */

/** Prefixo da área de quem recebe — a mesma tela mora em dois caminhos. */
function base(role: AppRole): string {
  return role === "admin" ? ADMIN_BASE : TEACHER_BASE;
}

const isStaff = (role: AppRole): boolean => role !== "student";

/** Tarefa: o aluno abre a entrega; a equipe abre a correção no planejador. */
function assignmentLink(role: AppRole, assignmentId: string): string {
  return isStaff(role)
    ? `${base(role)}/planejador/tarefa/${assignmentId}`
    : `/tarefas/${assignmentId}`;
}

/**
 * Aula: o aluno não tem tela por sessão — a agenda dele é o painel, e a aula
 * já dada vira item da biblioteca.
 */
function sessionLink(role: AppRole, sessionId: string, past = false): string {
  if (isStaff(role)) return `${base(role)}/planejador/aula/${sessionId}`;
  return past ? "/biblioteca" : "/dashboard";
}

function groupLink(role: AppRole, groupId: string): string {
  return isStaff(role) ? `${base(role)}/turmas/${groupId}` : "/turmas";
}

/**
 * Chat: `?c=` abre a conversa certa já na chegada — e, como o link entra na
 * chave de deduplicação, cada turma mantém a sua própria linha no sino.
 */
function chatLink(role: AppRole, conversationId?: string): string {
  const path = isStaff(role) ? `${base(role)}/mensagens` : "/mensagens";
  return conversationId ? `${path}?c=${conversationId}` : path;
}

/* ------------------------------------------------------------------ datas */

/** "seg, 12/03 às 19:00" — data curta no fuso da escola. */
function whenLabel(iso: string): string {
  const stamp = new Date(iso);
  if (Number.isNaN(stamp.getTime())) return "";
  const day = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(stamp);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(stamp);
  return `${day.replace(".", "")} às ${time}`;
}

/** "12/03" — para prazo de entrega, onde a hora raramente importa. */
function dayLabel(iso: string): string {
  const stamp = new Date(iso);
  if (Number.isNaN(stamp.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  }).format(stamp);
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/* --------------------------------------------------------------- tarefas */

export interface AssignmentTarget {
  groupId: string;
  /** `null` quando a criação não devolveu o id — o aviso cai na lista. */
  assignmentId: string | null;
}

/**
 * Tarefa publicada. Vai para os alunos das turmas escolhidas e para o
 * professor responsável quando quem criou foi a coordenação.
 */
export function notifyAssignmentCreated(input: {
  organizationId: string;
  actorId: string;
  title: string;
  dueAt?: string | null;
  targets: readonly AssignmentTarget[];
}): void {
  schedule(async () => {
    const groupIds = input.targets.map((target) => target.groupId);
    const [students, groups] = await Promise.all([
      audience.studentsOfGroups(groupIds),
      audience.groupRefs(groupIds),
    ]);
    const teachers = await audience.resolveRecipients(
      [...groups.values()].map((group) => group.teacherId),
    );

    const due = input.dueAt ? ` Entrega até ${dayLabel(input.dueAt)}.` : "";

    for (const target of input.targets) {
      const group = groups.get(target.groupId);
      const teacher = teachers.find((item) => item.id === group?.teacherId);

      await dispatchNotifications({
        organizationId: input.organizationId,
        recipients: [
          ...(students.get(target.groupId) ?? []),
          ...(teacher ? [teacher] : []),
        ],
        exclude: [input.actorId],
        build: (recipient) => ({
          type: "assignment_created",
          title: isStaff(recipient.role) ? "Nova tarefa na sua turma" : "Nova tarefa",
          body: `${input.title}${group ? ` · ${group.name}` : ""}.${due}`,
          link: target.assignmentId
            ? assignmentLink(recipient.role, target.assignmentId)
            : isStaff(recipient.role)
              ? `${base(recipient.role)}/planejador`
              : "/tarefas",
        }),
      });
    }
  });
}

/** Tarefa removida: quem ia entregar precisa saber, e o link morreu junto. */
export function notifyAssignmentDeleted(input: {
  organizationId: string;
  actorId: string;
  groupId: string;
  title: string;
}): void {
  schedule(async () => {
    const students = await audience.groupStudents(input.groupId);
    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: students,
      exclude: [input.actorId],
      build: () => ({
        type: "assignment_deleted",
        title: "Tarefa cancelada",
        body: `A tarefa "${input.title}" foi removida e não precisa mais ser entregue.`,
        link: "/tarefas",
      }),
    });
  });
}

/** Entrega do aluno → professor da turma (coordenação não entra: é volume). */
export function notifyAssignmentSubmitted(input: {
  organizationId: string;
  assignmentId: string;
  groupId: string;
  studentId: string;
  studentName: string;
  title: string;
}): void {
  schedule(async () => {
    const teacher = await audience.groupTeacher(input.groupId);
    if (!teacher) return;

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: [teacher],
      exclude: [input.studentId],
      build: (recipient) => ({
        type: "assignment_submitted",
        title: "Entrega para corrigir",
        body: `${input.studentName} entregou "${input.title}".`,
        link: assignmentLink(recipient.role, input.assignmentId),
      }),
    });
  });
}

/** Nota fechada → o aluno corrigido. */
export function notifyAssignmentGraded(input: {
  organizationId: string;
  actorId: string;
  assignmentId: string;
  studentId: string;
  title: string;
  score: number;
  maxScore: number | null;
}): void {
  schedule(async () => {
    const student = await audience.resolveRecipients([input.studentId]);
    const scale =
      input.maxScore != null ? `${input.score}/${input.maxScore}` : `${input.score}`;

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: student,
      exclude: [input.actorId],
      build: (recipient) => ({
        type: "assignment_graded",
        title: "Tarefa corrigida",
        body: `"${input.title}" recebeu nota ${scale}.`,
        link: assignmentLink(recipient.role, input.assignmentId),
      }),
    });
  });
}

/* ------------------------------------------------------------------ aulas */

/** Público de uma aula: alunos da turma + o professor escalado. */
async function sessionAudience(
  groupId: string,
  teacherId: string,
): Promise<{ people: Recipient[]; groupName: string }> {
  const [students, teachers, group] = await Promise.all([
    audience.groupStudents(groupId),
    audience.resolveRecipients([teacherId]),
    audience.groupRef(groupId),
  ]);
  return { people: [...students, ...teachers], groupName: group?.name ?? "" };
}

export function notifySessionScheduled(input: {
  organizationId: string;
  actorId: string;
  sessionId: string;
  groupId: string;
  teacherId: string;
  title: string;
  scheduledAt: string;
}): void {
  schedule(async () => {
    const { people, groupName } = await sessionAudience(input.groupId, input.teacherId);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: people,
      exclude: [input.actorId],
      build: (recipient) => ({
        type: "session_scheduled",
        title: isStaff(recipient.role) ? "Aula escalada para você" : "Nova aula agendada",
        body: `${input.title}${groupName ? ` · ${groupName}` : ""} — ${whenLabel(input.scheduledAt)}.`,
        link: sessionLink(recipient.role, input.sessionId),
      }),
    });
  });
}

export function notifySessionRescheduled(input: {
  organizationId: string;
  actorId: string;
  sessionId: string;
  groupId: string;
  teacherId: string;
  title: string;
  /** Novo horário, em UTC — o rótulo é montado no fuso da escola. */
  scheduledAt: string;
}): void {
  schedule(async () => {
    const { people, groupName } = await sessionAudience(input.groupId, input.teacherId);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: people,
      exclude: [input.actorId],
      build: (recipient) => ({
        type: "session_rescheduled",
        title: "Aula remarcada",
        body: `${input.title}${groupName ? ` · ${groupName}` : ""} agora é ${whenLabel(input.scheduledAt)}.`,
        link: sessionLink(recipient.role, input.sessionId),
      }),
    });
  });
}

/**
 * Cancelamento. Precisa dos dados da aula ANTES da escrita — depois de
 * cancelada a linha continua lá, mas quem chama já tem tudo em mãos.
 */
export function notifySessionCancelled(input: {
  organizationId: string;
  actorId: string;
  sessionId: string;
  groupId: string;
  teacherId: string;
  title: string;
  scheduledAt: string;
}): void {
  schedule(async () => {
    const { people, groupName } = await sessionAudience(input.groupId, input.teacherId);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: people,
      exclude: [input.actorId],
      build: (recipient) => ({
        type: "session_cancelled",
        title: "Aula cancelada",
        body: `${input.title}${groupName ? ` · ${groupName}` : ""} — ${whenLabel(input.scheduledAt)} — não vai acontecer.`,
        link: isStaff(recipient.role) ? `${base(recipient.role)}/planejador` : "/dashboard",
      }),
    });
  });
}

/** Aula começou: o aluno não entra na sala, mas fica sabendo que está no ar. */
export function notifySessionStarted(input: {
  organizationId: string;
  actorId: string;
  sessionId: string;
  groupId: string;
  title: string;
}): void {
  schedule(async () => {
    const students = await audience.groupStudents(input.groupId);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: students,
      exclude: [input.actorId],
      build: () => ({
        type: "session_started",
        title: "Sua aula começou",
        body: `${input.title} está acontecendo agora.`,
        link: "/dashboard",
      }),
    });
  });
}

/** Aula encerrada: o material vai para a biblioteca do aluno. */
export function notifySessionEnded(input: {
  organizationId: string;
  actorId: string;
  sessionId: string;
  groupId: string;
  title: string;
}): void {
  schedule(async () => {
    const students = await audience.groupStudents(input.groupId);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: students,
      exclude: [input.actorId],
      build: (recipient) => ({
        type: "session_completed",
        title: "Material da aula disponível",
        body: `${input.title} foi encerrada — o conteúdo já está na sua biblioteca.`,
        link: sessionLink(recipient.role, input.sessionId, true),
      }),
    });
  });
}

/**
 * Chamada registrada. Só quem faltou (ou chegou atrasado) é avisado: dizer
 * "você esteve presente" a uma turma inteira transformaria o sino em ruído.
 */
export function notifyAttendanceRecorded(input: {
  organizationId: string;
  actorId: string;
  sessionId: string;
  title: string;
  entries: ReadonlyArray<{ studentId: string; status: AttendanceStatus }>;
}): void {
  const flagged = input.entries.filter(
    (entry) => entry.status === "absent" || entry.status === "late",
  );
  if (flagged.length === 0) return;

  schedule(async () => {
    const students = await audience.resolveRecipients(
      flagged.map((entry) => entry.studentId),
    );
    const statusOf = new Map(flagged.map((entry) => [entry.studentId, entry.status]));

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: students,
      exclude: [input.actorId],
      build: (recipient) => {
        const status = statusOf.get(recipient.id);
        if (!status) return null;
        return {
          type: "attendance_recorded",
          title: status === "absent" ? "Falta registrada" : "Atraso registrado",
          body: `Presença da aula "${input.title}": ${status === "absent" ? "falta" : "atraso"}. Fale com seu professor se houver algo a corrigir.`,
          link: "/progresso",
        };
      },
    });
  });
}

/* ------------------------------------------------------- turmas e matrículas */

export type EnrollmentChange = "enrolled" | "transferred" | "removed";

/**
 * Matrícula criada, transferida ou cancelada.
 *
 * Três públicos com recortes diferentes: o aluno (é a vida escolar dele), os
 * professores das turmas de origem e destino (a lista deles mudou) e a
 * coordenação — esta só quando quem mexeu foi um professor, porque o admin
 * não precisa do eco da própria ação.
 */
export function notifyEnrollmentChange(input: {
  organizationId: string;
  actorId: string;
  actorRole: AppRole;
  studentId: string;
  studentName?: string;
  kind: EnrollmentChange;
  toGroupId?: string | null;
  fromGroupId?: string | null;
}): void {
  schedule(async () => {
    const groupIds = [input.toGroupId, input.fromGroupId].filter(
      (id): id is string => Boolean(id),
    );
    const [groups, student] = await Promise.all([
      audience.groupRefs(groupIds),
      audience.resolveRecipients([input.studentId]),
    ]);

    const to = input.toGroupId ? groups.get(input.toGroupId) : null;
    const from = input.fromGroupId ? groups.get(input.fromGroupId) : null;
    const studentName = input.studentName ?? student[0]?.name ?? "Um aluno";

    const teachers = await audience.resolveRecipients([to?.teacherId, from?.teacherId]);
    const admins =
      input.actorRole === "teacher" ? await audience.orgAdmins(input.organizationId) : [];

    // Para o aluno.
    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: student,
      exclude: [input.actorId],
      build: (recipient) => {
        if (input.kind === "removed") {
          return {
            type: "enrollment_removed",
            title: "Matrícula encerrada",
            body: from
              ? `Você saiu da turma ${from.name}. Fale com a coordenação em caso de dúvida.`
              : "Sua matrícula na turma foi encerrada.",
            link: groupLink(recipient.role, from?.id ?? ""),
          };
        }
        if (input.kind === "transferred") {
          return {
            type: "enrollment_transferred",
            title: "Você mudou de turma",
            body: `${from ? `De ${from.name} para ` : "Agora você está em "}${to?.name ?? "outra turma"}.`,
            link: groupLink(recipient.role, to?.id ?? ""),
          };
        }
        return {
          type: "enrollment_created",
          title: "Matrícula confirmada",
          body: `Você entrou na turma ${to?.name ?? ""}.`.trim(),
          link: groupLink(recipient.role, to?.id ?? ""),
        };
      },
    });

    // Para quem dá aula às turmas envolvidas, e para a coordenação quando o
    // movimento partiu de um professor.
    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: [...teachers, ...admins],
      exclude: [input.actorId, input.studentId],
      build: (recipient) => {
        const mine =
          recipient.role === "admin"
            ? null
            : recipient.id === to?.teacherId
              ? "to"
              : recipient.id === from?.teacherId
                ? "from"
                : null;

        if (input.kind === "removed" || mine === "from") {
          return {
            type: "enrollment_removed",
            title: "Aluno saiu da turma",
            body: `${studentName} não está mais em ${from?.name ?? "sua turma"}.`,
            link: groupLink(recipient.role, from?.id ?? to?.id ?? ""),
          };
        }
        return {
          type: input.kind === "transferred" ? "enrollment_transferred" : "enrollment_created",
          title: "Novo aluno na turma",
          body: `${studentName} entrou em ${to?.name ?? "uma turma"}${
            input.kind === "transferred" && from ? ` (veio de ${from.name})` : ""
          }.`,
          link: groupLink(recipient.role, to?.id ?? ""),
        };
      },
    });
  });
}

/** Turma criada — o professor responsável e, se quem criou foi ele, a coordenação. */
export function notifyGroupCreated(input: {
  organizationId: string;
  actorId: string;
  actorRole: AppRole;
  groupId: string;
}): void {
  schedule(async () => {
    const group = await audience.groupRef(input.groupId);
    if (!group) return;

    const [teacher, admins] = await Promise.all([
      audience.resolveRecipients([group.teacherId]),
      input.actorRole === "teacher"
        ? audience.orgAdmins(input.organizationId)
        : Promise.resolve([]),
    ]);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: [...teacher, ...admins],
      exclude: [input.actorId],
      build: (recipient) => ({
        type: "group_created",
        title:
          recipient.id === group.teacherId ? "Você é o responsável por uma turma" : "Turma criada",
        body: `${group.name} foi criada e já aparece na agenda.`,
        link: groupLink(recipient.role, group.id),
      }),
    });
  });
}

/** Turma trocou de responsável: os dois professores precisam saber. */
export function notifyGroupHandover(input: {
  organizationId: string;
  actorId: string;
  groupId: string;
  previousTeacherId: string;
  sessions: number;
}): void {
  schedule(async () => {
    const group = await audience.groupRef(input.groupId);
    if (!group) return;

    const people = await audience.resolveRecipients([
      group.teacherId,
      input.previousTeacherId,
    ]);
    const moved =
      input.sessions > 0
        ? ` ${input.sessions} aula${input.sessions > 1 ? "s futuras foram" : " futura foi"} junto.`
        : "";

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: people,
      exclude: [input.actorId],
      build: (recipient) =>
        recipient.id === group.teacherId
          ? {
              type: "group_handover",
              title: "Uma turma passou a ser sua",
              body: `Você é o novo responsável por ${group.name}.${moved}`,
              link: groupLink(recipient.role, group.id),
            }
          : {
              type: "group_handover",
              title: "Turma reatribuída",
              body: `${group.name} passou para outro professor.${moved}`,
              link: groupLink(recipient.role, group.id),
            },
    });

    // O aluno não precisa do detalhe administrativo, mas precisa saber que
    // quem entra na sala mudou.
    const students = await audience.groupStudents(input.groupId);
    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: students,
      exclude: [input.actorId],
      build: (recipient) => ({
        type: "group_handover",
        title: "Sua turma tem novo professor",
        body: `${group.name} passou a ser conduzida por outro professor.`,
        link: groupLink(recipient.role, group.id),
      }),
    });
  });
}

/** Grade de horários mexida: muda o dia a dia de quem assiste. */
export function notifyGroupScheduleChanged(input: {
  organizationId: string;
  actorId: string;
  groupId: string;
}): void {
  schedule(async () => {
    const group = await audience.groupRef(input.groupId);
    if (!group) return;

    const [students, teacher] = await Promise.all([
      audience.groupStudents(input.groupId),
      audience.resolveRecipients([group.teacherId]),
    ]);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: [...students, ...teacher],
      exclude: [input.actorId],
      build: (recipient) => ({
        type: "group_schedule_changed",
        title: "Horário da turma mudou",
        body: `A grade de ${group.name} foi alterada — confira os próximos encontros.`,
        link: isStaff(recipient.role) ? `${base(recipient.role)}/planejador` : "/dashboard",
      }),
    });
  });
}

/**
 * Turma arquivada ou reativada. Arquivar tira a turma da operação do dia a
 * dia sem apagar histórico — quem dá aula e quem assiste precisam saber.
 */
export function notifyGroupActiveChanged(input: {
  organizationId: string;
  actorId: string;
  groupId: string;
  isActive: boolean;
}): void {
  schedule(async () => {
    const group = await audience.groupRef(input.groupId);
    if (!group) return;

    const [students, teacher] = await Promise.all([
      audience.groupStudents(input.groupId),
      audience.resolveRecipients([group.teacherId]),
    ]);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: [...students, ...teacher],
      exclude: [input.actorId],
      build: (recipient) => ({
        type: input.isActive ? "group_reactivated" : "group_archived",
        title: input.isActive ? "Turma reativada" : "Turma encerrada",
        body: input.isActive
          ? `${group.name} voltou a funcionar.`
          : `${group.name} foi arquivada. Fale com a coordenação sobre os próximos passos.`,
        link: groupLink(recipient.role, group.id),
      }),
    });
  });
}

/* ------------------------------------------------------------------- chat */

/**
 * Mensagem nova no chat da turma.
 *
 * Deduplica por conversa enquanto o aviso anterior não foi lido: uma
 * discussão de trinta mensagens gera uma linha no sino, não trinta.
 */
export function notifyChatMessage(input: {
  organizationId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
}): void {
  schedule(async () => {
    const people = await audience.chatAudience(input.conversationId);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: people,
      exclude: [input.senderId],
      dedupe: { unread: true },
      build: (recipient) => ({
        type: "chat_message",
        title: `Nova mensagem de ${input.senderName}`,
        body: input.body,
        link: chatLink(recipient.role, input.conversationId),
      }),
    });
  });
}

/** Chat aberto/fechado para os alunos — quem é afetado são eles. */
export function notifyChatPostingChanged(input: {
  organizationId: string;
  conversationId: string;
  actorId: string;
  allowed: boolean;
}): void {
  schedule(async () => {
    const people = await audience.chatAudience(input.conversationId);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: people.filter((person) => person.role === "student"),
      exclude: [input.actorId],
      build: (recipient) => ({
        type: "chat_posting_changed",
        title: input.allowed ? "Chat liberado" : "Chat fechado para alunos",
        body: input.allowed
          ? "Você já pode escrever no chat da sua turma."
          : "O professor desativou as mensagens dos alunos nesta turma.",
        link: chatLink(recipient.role, input.conversationId),
      }),
    });
  });
}

/* -------------------------------------------------- pedidos e coordenação */

/**
 * Pedido de troca de turma: decide o professor da turma de destino, com
 * cópia para a coordenação — é ela quem arbitra se o professor não responder.
 */
export function notifyGroupChangeRequest(input: {
  organizationId: string;
  studentId: string;
  studentName: string;
  toGroupId: string;
  fromGroupId?: string | null;
  reason?: string | null;
}): void {
  schedule(async () => {
    const [teacher, admins, groups] = await Promise.all([
      audience.groupTeacher(input.toGroupId),
      audience.orgAdmins(input.organizationId),
      audience.groupRefs([input.toGroupId, input.fromGroupId].filter(
        (id): id is string => Boolean(id),
      )),
    ]);
    const group = groups.get(input.toGroupId);
    const fromGroupName = input.fromGroupId ? groups.get(input.fromGroupId)?.name : null;

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: [...(teacher ? [teacher] : []), ...admins],
      exclude: [input.studentId],
      build: (recipient) => ({
        type: "group_change_request",
        title: "Pedido de troca de turma",
        body: `${input.studentName} quer entrar em ${group?.name ?? "outra turma"}${
          fromGroupName ? ` (hoje em ${fromGroupName})` : ""
        }.${input.reason ? ` Motivo: ${input.reason}` : ""}`,
        link: groupLink(recipient.role, input.toGroupId),
      }),
    });
  });
}

/** Comunicado da coordenação — escola inteira ou uma turma. */
export function notifyAnnouncement(input: {
  organizationId: string;
  actorId: string;
  title: string;
  body: string;
  recipients: readonly Recipient[];
}): void {
  schedule(async () => {
    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: input.recipients,
      exclude: [input.actorId],
      build: () => ({
        type: "announcement",
        title: input.title,
        body: input.body,
        link: null,
      }),
    });
  });
}

/** Pedido de exclusão de dados (LGPD) → coordenação. */
export function notifyLgpdRequest(input: {
  organizationId: string;
  requesterId: string;
  requesterName: string;
}): void {
  schedule(async () => {
    const admins = await audience.orgAdmins(input.organizationId);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: admins,
      exclude: [input.requesterId],
      build: () => ({
        type: "lgpd_request",
        title: "Solicitação de exclusão de dados (LGPD)",
        body: `${input.requesterName} solicitou a exclusão dos próprios dados pessoais.`,
        link: `${ADMIN_BASE}/usuarios/${input.requesterId}`,
      }),
    });
  });
}

/* -------------------------------------------------------------- captação */

/**
 * Contato vindo do site.
 *
 * Só a coordenação recebe: é ela quem responde. O lead ainda não tem tela
 * própria — o painel inicial é onde o número aparece —, então o link leva
 * para lá em vez de inventar uma rota que não existe.
 *
 * Sem dedupe, de propósito. A chave de `dispatchNotifications` é
 * destinatário + tipo + link, e todo lead aponta para o mesmo painel — uma
 * janela de tempo aqui calaria o segundo visitante da janela, não o envio
 * repetido do primeiro. Entre repetir um aviso e engolir um interessado, a
 * coordenação prefere repetir; o freio contra enxurrada é o rate limit por
 * IP na própria action.
 */
export function notifyLeadReceived(input: {
  organizationId: string;
  name: string;
  /** `trial` é o pedido de aula experimental; `contact`, o formulário geral. */
  kind: "contact" | "trial";
  /** Telefone ou e-mail — o que a coordenação precisa para responder. */
  contact?: string | null;
}): void {
  schedule(async () => {
    const admins = await audience.orgAdmins(input.organizationId);
    const reach = input.contact ? ` · ${input.contact}` : "";

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: admins,
      build: () =>
        input.kind === "trial"
          ? {
              type: "trial_request",
              title: "Pedido de aula experimental",
              body: `${input.name} quer marcar uma aula experimental${reach}.`,
              link: ADMIN_BASE,
            }
          : {
              type: "lead_received",
              title: "Novo contato pelo site",
              body: `${input.name} enviou uma mensagem pelo formulário de contato${reach}.`,
              link: ADMIN_BASE,
            },
    });
  });
}

/* ----------------------------------------------------------------- conta */

/** Convite aceito → coordenação: alguém novo entrou na escola. */
export function notifyInviteAccepted(input: {
  organizationId: string;
  userId: string;
  userName: string;
  role: AppRole;
}): void {
  const ROLE_LABEL: Record<AppRole, string> = {
    admin: "coordenação",
    teacher: "professor",
    student: "aluno",
  };

  schedule(async () => {
    const admins = await audience.orgAdmins(input.organizationId);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: admins,
      exclude: [input.userId],
      build: () => ({
        type: "invite_accepted",
        title: "Convite aceito",
        body: `${input.userName} concluiu o cadastro como ${ROLE_LABEL[input.role]}.`,
        link: `${ADMIN_BASE}/usuarios/${input.userId}`,
      }),
    });
  });
}

/** Mudança de papel: muda a área em que a pessoa entra no próximo login. */
export function notifyRoleChanged(input: {
  organizationId: string;
  actorId: string;
  userId: string;
  role: AppRole;
}): void {
  const AREA: Record<AppRole, string> = {
    admin: "coordenação",
    teacher: "professor",
    student: "aluno",
  };

  schedule(async () => {
    const person = await audience.resolveRecipients([input.userId]);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: person,
      exclude: [input.actorId],
      build: () => ({
        type: "role_changed",
        title: "Seu acesso mudou",
        body: `Seu perfil agora é de ${AREA[input.role]}. Entre novamente para ver as telas certas.`,
        link: null,
      }),
    });
  });
}

/** Senha provisória definida pela coordenação. */
export function notifyPasswordReset(input: {
  organizationId: string;
  actorId: string;
  userId: string;
}): void {
  schedule(async () => {
    const person = await audience.resolveRecipients([input.userId]);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: person,
      exclude: [input.actorId],
      build: () => ({
        type: "password_reset",
        title: "Senha redefinida pela coordenação",
        body: "Sua senha foi trocada por uma provisória. Você vai precisar criar uma nova no próximo acesso.",
        link: null,
      }),
    });
  });
}

/** Convite gerado → o resto da coordenação, que compartilha a fila de cadastro. */
export function notifyInviteCreated(input: {
  organizationId: string;
  actorId: string;
  name: string;
  role: AppRole;
}): void {
  const ROLE_LABEL: Record<AppRole, string> = {
    admin: "coordenação",
    teacher: "professor",
    student: "aluno",
  };

  schedule(async () => {
    const admins = await audience.orgAdmins(input.organizationId);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: admins,
      exclude: [input.actorId],
      build: () => ({
        type: "invite_created",
        title: "Convite gerado",
        body: `${input.name} foi convidado como ${ROLE_LABEL[input.role]} e ainda não concluiu o cadastro.`,
        link: `${ADMIN_BASE}/usuarios`,
      }),
    });
  });
}

/**
 * Senha trocada pela própria pessoa. É um aviso de segurança, não uma
 * confirmação de sucesso — quem não reconhece a troca precisa ver isso em
 * algum lugar. Por isso, ao contrário do resto do catálogo, o autor do ato
 * *é* o destinatário e não entra em `exclude`.
 */
export function notifyPasswordChanged(input: {
  organizationId: string;
  userId: string;
}): void {
  schedule(async () => {
    const person = await audience.resolveRecipients([input.userId]);

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: person,
      build: () => ({
        type: "password_changed",
        title: "Sua senha foi alterada",
        body: "A troca foi feita agora, com a senha atual confirmada. Se não foi você, fale com a coordenação.",
        link: null,
      }),
    });
  });
}

/* ------------------------------------------------------------- cobrança */

/**
 * Fatura paga ou recusada. O aluno é o interessado direto; a coordenação
 * recebe porque é quem cobra, concilia e libera vaga.
 *
 * A Stripe reentrega webhook em caso de erro, então a janela de dedupe evita
 * o mesmo aviso duas vezes pela mesma fatura.
 */
export function notifyInvoiceOutcome(input: {
  organizationId: string;
  studentId: string;
  studentName?: string;
  paid: boolean;
  amountCents: number | null;
  planName?: string | null;
}): void {
  schedule(async () => {
    const [student, admins] = await Promise.all([
      audience.resolveRecipients([input.studentId]),
      audience.orgAdmins(input.organizationId),
    ]);
    const amount = input.amountCents != null ? money.format(input.amountCents / 100) : null;
    const name = input.studentName ?? student[0]?.name ?? "Um aluno";
    const plan = input.planName ? ` (${input.planName})` : "";

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: [...student, ...admins],
      dedupe: { withinMinutes: 60 },
      build: (recipient) => {
        const own = recipient.id === input.studentId;
        if (input.paid) {
          return {
            type: "payment_succeeded",
            title: own ? "Pagamento confirmado" : "Pagamento recebido",
            body: own
              ? `Recebemos seu pagamento${amount ? ` de ${amount}` : ""}${plan}. Tudo certo com sua matrícula.`
              : `${name} pagou${amount ? ` ${amount}` : ""}${plan}.`,
            link: own ? "/planos" : `${ADMIN_BASE}/planos-de-alunos`,
          };
        }
        return {
          type: "payment_failed",
          title: own ? "Pagamento não aprovado" : "Pagamento recusado",
          body: own
            ? `Não conseguimos processar sua cobrança${amount ? ` de ${amount}` : ""}${plan}. Atualize a forma de pagamento para manter o acesso.`
            : `A cobrança de ${name}${amount ? ` (${amount})` : ""} foi recusada.`,
          link: own ? "/planos" : `${ADMIN_BASE}/planos-de-alunos`,
        };
      },
    });
  });
}

/* --------------------------------------------------------------- agenda */

/** A agenda tem tela própria em cada área — o aviso leva direto para ela. */
function agendaLink(role: AppRole): string {
  return isStaff(role) ? `${base(role)}/agenda` : "/agenda";
}

/**
 * Público de um compromisso da agenda.
 *
 * O `audience` do próprio compromisso já é o recorte editorial (reunião de
 * coordenação não desce para aluno), e ele é aplicado aqui pelo mesmo motivo
 * que é aplicado na leitura: esconder na tela e avisar mesmo assim seria
 * vazar pelo sino o que a agenda esconde.
 */
async function agendaAudience(input: {
  organizationId: string;
  groupId: string | null;
  audience: "all" | "staff" | "students";
}): Promise<{ people: Recipient[]; groupName: string | null }> {
  const wantsStudents = input.audience !== "staff";
  const wantsStaff = input.audience !== "students";

  if (input.groupId === null) {
    const everyone = await audience.orgMembers(input.organizationId);
    return {
      people: everyone.filter((person) =>
        person.role === "student" ? wantsStudents : wantsStaff,
      ),
      groupName: null,
    };
  }

  const [group, students, teacher, admins] = await Promise.all([
    audience.groupRef(input.groupId),
    wantsStudents ? audience.groupStudents(input.groupId) : Promise.resolve([]),
    audience.groupTeacher(input.groupId),
    audience.orgAdmins(input.organizationId),
  ]);

  return {
    people: [...students, ...(wantsStaff && teacher ? [teacher] : []), ...admins],
    groupName: group?.name ?? null,
  };
}

export function notifyAgendaEvent(input: {
  organizationId: string;
  actorId: string;
  groupId: string | null;
  audience: "all" | "staff" | "students";
  title: string;
  startsAt: string;
  allDay: boolean;
  /** `created` na primeira gravação; `updated`/`deleted` nas seguintes. */
  change: "created" | "updated" | "deleted";
}): void {
  schedule(async () => {
    const { people, groupName } = await agendaAudience(input);
    const when = input.allDay ? dayLabel(input.startsAt) : whenLabel(input.startsAt);
    const scope = groupName ? ` · ${groupName}` : " · escola";

    const copy = {
      created: { type: "agenda_event_created", title: "Novo compromisso na agenda" },
      updated: { type: "agenda_event_updated", title: "Compromisso remarcado" },
      deleted: { type: "agenda_event_deleted", title: "Compromisso cancelado" },
    }[input.change];

    await dispatchNotifications({
      organizationId: input.organizationId,
      recipients: people,
      exclude: [input.actorId],
      build: (recipient) => ({
        type: copy.type,
        title: copy.title,
        body: `${input.title}${scope} — ${when}.`,
        link: agendaLink(recipient.role),
      }),
    });
  });
}
