import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CefrLevel } from "@/types/domain";
import { CEFR_LEVELS } from "@/types/domain";

/**
 * Fuso da escola. Bucketizar por mês em UTC jogaria as aulas da noite do
 * dia 31 para o mês seguinte — o que faria a série mensal do painel não
 * bater com o que o admin vê na agenda.
 */
const TZ = "America/Sao_Paulo";

/** Frequência abaixo disso coloca o aluno na lista de risco (mesmo corte dos relatórios). */
const RISK_THRESHOLD = 75;

export interface MetricDelta {
  /** Variação percentual contra o mês anterior. `null` quando não há base de comparação. */
  changePercent: number | null;
  previous: number;
}

export interface MonthlyPoint {
  /** `YYYY-MM` no fuso da escola. */
  key: string;
  label: string;
  sessions: number;
  newStudents: number;
  newEnrollments: number;
  leads: number;
}

export interface LevelSlice {
  level: CefrLevel;
  students: number;
  groups: number;
}

export interface GroupOccupancy {
  groupId: string;
  name: string;
  level: CefrLevel;
  teacherName: string;
  enrolled: number;
  maxStudents: number;
  occupancyRate: number;
  attendanceRate: number | null;
}

export interface TeacherPerformance {
  teacherId: string;
  name: string;
  groups: number;
  students: number;
  sessionsCompleted: number;
  hours: number;
}

export interface RiskStudent {
  studentId: string;
  name: string;
  groupName: string;
  attendanceRate: number;
  sessionsMissed: number;
}

export interface UpcomingSession {
  id: string;
  title: string;
  groupName: string;
  teacherName: string;
  scheduledAt: string;
  durationMinutes: number;
}

export interface LeadSource {
  source: string;
  count: number;
}

export interface WeekdayLoad {
  weekday: number;
  label: string;
  sessions: number;
}

export interface AdminDashboard {
  students: { active: number; paying: number; inactive: number; delta: MetricDelta };
  teachers: { active: number; withGroups: number };
  groups: { active: number; total: number; occupancyRate: number; seatsOpen: number };
  courses: { active: number; total: number };
  sessions: {
    completedThisMonth: number;
    hoursThisMonth: number;
    scheduledNext7Days: number;
    inProgress: number;
    cancelledThisMonth: number;
    delta: MetricDelta;
  };
  attendance: { rate: number | null; sampledSessions: number; atRisk: number };
  assignments: {
    total: number;
    deliveryRate: number | null;
    awaitingReview: number;
    averageScore: number | null;
  };
  leads: { thisMonth: number; total: number; delta: MetricDelta; sources: LeadSource[] };
  monthly: MonthlyPoint[];
  levels: LevelSlice[];
  occupancy: GroupOccupancy[];
  teacherRanking: TeacherPerformance[];
  riskStudents: RiskStudent[];
  upcoming: UpcomingSession[];
  weekdayLoad: WeekdayLoad[];
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

function monthKey(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "yyyy-MM");
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round(((100 * part) / total) * 10) / 10;
}

function delta(current: number, previous: number): MetricDelta {
  if (previous <= 0) return { changePercent: current > 0 ? 100 : null, previous };
  return {
    changePercent: Math.round(((current - previous) / previous) * 1000) / 10,
    previous,
  };
}

/** Últimos 12 meses (inclusive o corrente), do mais antigo ao mais novo. */
function buildMonthWindow(now: Date): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  const year = Number(formatInTimeZone(now, TZ, "yyyy"));
  const month = Number(formatInTimeZone(now, TZ, "MM"));

  for (let offset = 11; offset >= 0; offset--) {
    // Dia 15 ao meio-dia UTC: longe o bastante das bordas para o fuso não
    // empurrar a âncora para o mês vizinho.
    const anchor = new Date(Date.UTC(year, month - 1 - offset, 15, 12));
    months.push({
      key: formatInTimeZone(anchor, TZ, "yyyy-MM"),
      label: formatInTimeZone(anchor, TZ, "LLL"),
    });
  }
  return months;
}

/**
 * Agregado único do painel admin. Usa o client service-role — a página que
 * consome já passou por `requireRole(["admin"])` e toda query abaixo é
 * explicitamente escopada por `organization_id`, o mesmo contrato de
 * `repositories/users.ts`. Motivo: o painel cruza a organização inteira numa
 * tela só; fazer isso via RLS custaria dezenas de round-trips.
 */
export async function getAdminDashboard(organizationId: string): Promise<AdminDashboard> {
  const admin = createAdminSupabaseClient();

  const [
    { data: profiles },
    { data: groups },
    { data: courses },
    { data: enrollments },
    { data: sessions },
    { data: attendance },
    { data: assignments },
    { data: submissions },
    { data: studentProfiles },
    { data: leads },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, role, is_active, deleted_at, created_at")
      .eq("organization_id", organizationId),
    admin
      .from("groups")
      .select("id, name, level, max_students, is_active, teacher_id, created_at")
      .eq("organization_id", organizationId),
    admin.from("courses").select("id, is_active").eq("organization_id", organizationId),
    admin
      .from("enrollments")
      .select("id, student_id, group_id, status, enrolled_at")
      .eq("organization_id", organizationId),
    admin
      .from("class_sessions")
      .select("id, group_id, teacher_id, status, scheduled_at, duration_minutes, title")
      .eq("organization_id", organizationId),
    admin
      .from("attendance")
      .select("status, student_id, session_id")
      .eq("organization_id", organizationId),
    admin
      .from("assignments")
      .select("id, group_id, max_score, created_at")
      .eq("organization_id", organizationId),
    admin
      .from("assignment_submissions")
      .select("assignment_id, student_id, status, score")
      .eq("organization_id", organizationId),
    admin
      .from("student_profiles")
      .select("profile_id, current_level")
      .eq("organization_id", organizationId),
    admin
      .from("leads")
      .select("id, source, created_at")
      .eq("organization_id", organizationId),
  ]);

  const now = new Date();
  const months = buildMonthWindow(now);
  const currentMonth = months[months.length - 1]!.key;
  const previousMonth = months[months.length - 2]?.key ?? "";

  // ---------- Pessoas ----------
  const livingProfiles = (profiles ?? []).filter((p) => !p.deleted_at);
  const profileName = new Map(livingProfiles.map((p) => [p.id, p.full_name]));
  const students = livingProfiles.filter((p) => p.role === "student");
  const teachers = livingProfiles.filter((p) => p.role === "teacher");
  const activeStudents = students.filter((p) => p.is_active);
  const activeTeachers = teachers.filter((p) => p.is_active);

  const newStudentsThisMonth = students.filter(
    (p) => monthKey(p.created_at) === currentMonth,
  ).length;
  const newStudentsPreviousMonth = students.filter(
    (p) => monthKey(p.created_at) === previousMonth,
  ).length;

  // ---------- Turmas e matrículas ----------
  const groupRows = groups ?? [];
  const activeGroups = groupRows.filter((g) => g.is_active);
  const activeGroupIds = new Set(activeGroups.map((g) => g.id));
  const activeEnrollments = (enrollments ?? []).filter((e) => e.status === "active");
  const payingStudents = new Set(
    activeEnrollments
      .filter((e) => activeGroupIds.has(e.group_id))
      .map((e) => e.student_id),
  ).size;

  const enrolledByGroup = new Map<string, number>();
  const studentsByGroup = new Map<string, Set<string>>();
  for (const e of activeEnrollments) {
    enrolledByGroup.set(e.group_id, (enrolledByGroup.get(e.group_id) ?? 0) + 1);
    if (!studentsByGroup.has(e.group_id)) studentsByGroup.set(e.group_id, new Set());
    studentsByGroup.get(e.group_id)!.add(e.student_id);
  }

  const totalSeats = activeGroups.reduce((sum, g) => sum + g.max_students, 0);
  const takenSeats = activeGroups.reduce(
    (sum, g) => sum + (enrolledByGroup.get(g.id) ?? 0),
    0,
  );

  // ---------- Aulas ----------
  const sessionRows = sessions ?? [];
  const sessionById = new Map(sessionRows.map((s) => [s.id, s]));
  const groupName = new Map(groupRows.map((g) => [g.id, g.name]));
  const completed = sessionRows.filter((s) => s.status === "completed");
  const completedThisMonth = completed.filter(
    (s) => monthKey(s.scheduled_at) === currentMonth,
  );
  const completedPreviousMonth = completed.filter(
    (s) => monthKey(s.scheduled_at) === previousMonth,
  );

  const nowMs = now.getTime();
  const in7Days = nowMs + 7 * 24 * 60 * 60 * 1000;
  const scheduledNext7Days = sessionRows.filter((s) => {
    const at = new Date(s.scheduled_at).getTime();
    return s.status === "scheduled" && at >= nowMs && at <= in7Days;
  }).length;

  const upcoming: UpcomingSession[] = sessionRows
    .filter(
      (s) =>
        (s.status === "scheduled" || s.status === "in_progress") &&
        new Date(s.scheduled_at).getTime() >= nowMs,
    )
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 6)
    .map((s) => ({
      id: s.id,
      title: s.title,
      groupName: groupName.get(s.group_id) ?? "—",
      teacherName: profileName.get(s.teacher_id) ?? "—",
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
    }));

  // `i` do date-fns é 1=segunda … 7=domingo; o `% 7` normaliza domingo para
  // 0, alinhando com WEEKDAY_LABELS.
  const weekdayCounts: number[] = new Array(7).fill(0);
  for (const s of sessionRows) {
    if (s.status === "cancelled") continue;
    const weekday = Number(formatInTimeZone(new Date(s.scheduled_at), TZ, "i")) % 7;
    weekdayCounts[weekday] = (weekdayCounts[weekday] ?? 0) + 1;
  }
  const weekdayLoad: WeekdayLoad[] = weekdayCounts.map((count, index) => ({
    weekday: index,
    label: WEEKDAY_LABELS[index]!,
    sessions: count,
  }));

  // ---------- Frequência ----------
  interface Bucket {
    present: number;
    total: number;
  }
  const attendanceByGroup = new Map<string, Bucket>();
  const attendanceByStudent = new Map<string, Bucket & { groupId: string }>();
  let presentTotal = 0;
  let attendanceTotal = 0;

  for (const row of attendance ?? []) {
    const session = sessionById.get(row.session_id);
    if (!session || session.status !== "completed") continue;
    const counted = row.status === "present" || row.status === "late";

    attendanceTotal += 1;
    if (counted) presentTotal += 1;

    const groupBucket = attendanceByGroup.get(session.group_id) ?? {
      present: 0,
      total: 0,
    };
    groupBucket.total += 1;
    if (counted) groupBucket.present += 1;
    attendanceByGroup.set(session.group_id, groupBucket);

    const studentKey = `${session.group_id}:${row.student_id}`;
    const studentBucket = attendanceByStudent.get(studentKey) ?? {
      present: 0,
      total: 0,
      groupId: session.group_id,
    };
    studentBucket.total += 1;
    if (counted) studentBucket.present += 1;
    attendanceByStudent.set(studentKey, studentBucket);
  }

  const riskStudents: RiskStudent[] = [];
  for (const [key, bucket] of attendanceByStudent) {
    if (bucket.total === 0) continue;
    const rate = pct(bucket.present, bucket.total);
    if (rate >= RISK_THRESHOLD) continue;
    const studentId = key.slice(key.indexOf(":") + 1);
    riskStudents.push({
      studentId,
      name: profileName.get(studentId) ?? "—",
      groupName: groupName.get(bucket.groupId) ?? "—",
      attendanceRate: rate,
      sessionsMissed: bucket.total - bucket.present,
    });
  }
  riskStudents.sort((a, b) => a.attendanceRate - b.attendanceRate);

  const occupancy: GroupOccupancy[] = activeGroups
    .map((g) => {
      const bucket = attendanceByGroup.get(g.id);
      const enrolled = enrolledByGroup.get(g.id) ?? 0;
      return {
        groupId: g.id,
        name: g.name,
        level: g.level,
        teacherName: profileName.get(g.teacher_id) ?? "—",
        enrolled,
        maxStudents: g.max_students,
        occupancyRate: pct(enrolled, g.max_students),
        attendanceRate:
          bucket && bucket.total > 0 ? pct(bucket.present, bucket.total) : null,
      };
    })
    .sort((a, b) => b.occupancyRate - a.occupancyRate);

  // ---------- Tarefas ----------
  const assignmentRows = assignments ?? [];
  const submissionRows = submissions ?? [];
  const deliveredStatuses = new Set(["submitted", "graded", "late"]);
  const delivered = submissionRows.filter((s) => deliveredStatuses.has(s.status)).length;
  const awaitingReview = submissionRows.filter((s) => s.status === "submitted").length;

  // Esperadas = para cada tarefa, os alunos com matrícula ativa na turma dela.
  const expectedSubmissions = assignmentRows.reduce(
    (sum, a) => sum + (studentsByGroup.get(a.group_id)?.size ?? 0),
    0,
  );

  const maxScoreByAssignment = new Map(
    assignmentRows.map((a) => [a.id, a.max_score ?? 100]),
  );
  const graded = submissionRows.filter((s) => s.status === "graded" && s.score !== null);
  const averageScore =
    graded.length > 0
      ? Math.round(
          (graded.reduce((sum, s) => {
            const max = maxScoreByAssignment.get(s.assignment_id) || 100;
            return sum + (100 * (s.score ?? 0)) / max;
          }, 0) /
            graded.length) *
            10,
        ) / 10
      : null;

  // ---------- Leads ----------
  const leadRows = leads ?? [];
  const leadsThisMonth = leadRows.filter(
    (l) => monthKey(l.created_at) === currentMonth,
  ).length;
  const leadsPreviousMonth = leadRows.filter(
    (l) => monthKey(l.created_at) === previousMonth,
  ).length;
  const sourceCounts = new Map<string, number>();
  for (const l of leadRows) {
    sourceCounts.set(l.source, (sourceCounts.get(l.source) ?? 0) + 1);
  }

  // ---------- Séries mensais ----------
  const monthly: MonthlyPoint[] = months.map(({ key, label }) => ({
    key,
    label,
    sessions: completed.filter((s) => monthKey(s.scheduled_at) === key).length,
    newStudents: students.filter((p) => monthKey(p.created_at) === key).length,
    newEnrollments: (enrollments ?? []).filter((e) => monthKey(e.enrolled_at) === key)
      .length,
    leads: leadRows.filter((l) => monthKey(l.created_at) === key).length,
  }));

  // ---------- Níveis CEFR ----------
  const studentsByLevel = new Map<CefrLevel, number>();
  for (const sp of studentProfiles ?? []) {
    studentsByLevel.set(
      sp.current_level,
      (studentsByLevel.get(sp.current_level) ?? 0) + 1,
    );
  }
  const groupsByLevel = new Map<CefrLevel, number>();
  for (const g of activeGroups) {
    groupsByLevel.set(g.level, (groupsByLevel.get(g.level) ?? 0) + 1);
  }
  const levels: LevelSlice[] = CEFR_LEVELS.map((level) => ({
    level,
    students: studentsByLevel.get(level) ?? 0,
    groups: groupsByLevel.get(level) ?? 0,
  }));

  // ---------- Professores ----------
  const teacherRanking: TeacherPerformance[] = activeTeachers
    .map((t) => {
      const ownGroups = activeGroups.filter((g) => g.teacher_id === t.id);
      const done = completed.filter((s) => s.teacher_id === t.id);
      const studentSet = new Set<string>();
      for (const g of ownGroups) {
        for (const id of studentsByGroup.get(g.id) ?? []) studentSet.add(id);
      }
      return {
        teacherId: t.id,
        name: t.full_name,
        groups: ownGroups.length,
        students: studentSet.size,
        sessionsCompleted: done.length,
        hours:
          Math.round((done.reduce((sum, s) => sum + s.duration_minutes, 0) / 60) * 10) /
          10,
      };
    })
    .sort((a, b) => b.sessionsCompleted - a.sessionsCompleted || b.students - a.students);

  return {
    students: {
      active: activeStudents.length,
      paying: payingStudents,
      inactive: students.length - activeStudents.length,
      delta: delta(newStudentsThisMonth, newStudentsPreviousMonth),
    },
    teachers: {
      active: activeTeachers.length,
      withGroups: new Set(activeGroups.map((g) => g.teacher_id)).size,
    },
    groups: {
      active: activeGroups.length,
      total: groupRows.length,
      occupancyRate: pct(takenSeats, totalSeats),
      seatsOpen: Math.max(0, totalSeats - takenSeats),
    },
    courses: {
      active: (courses ?? []).filter((c) => c.is_active).length,
      total: (courses ?? []).length,
    },
    sessions: {
      completedThisMonth: completedThisMonth.length,
      hoursThisMonth:
        Math.round(
          (completedThisMonth.reduce((sum, s) => sum + s.duration_minutes, 0) / 60) * 10,
        ) / 10,
      scheduledNext7Days,
      inProgress: sessionRows.filter((s) => s.status === "in_progress").length,
      cancelledThisMonth: sessionRows.filter(
        (s) => s.status === "cancelled" && monthKey(s.scheduled_at) === currentMonth,
      ).length,
      delta: delta(completedThisMonth.length, completedPreviousMonth.length),
    },
    attendance: {
      rate: attendanceTotal > 0 ? pct(presentTotal, attendanceTotal) : null,
      sampledSessions: completed.length,
      atRisk: riskStudents.length,
    },
    assignments: {
      total: assignmentRows.length,
      deliveryRate: expectedSubmissions > 0 ? pct(delivered, expectedSubmissions) : null,
      awaitingReview,
      averageScore,
    },
    leads: {
      thisMonth: leadsThisMonth,
      total: leadRows.length,
      delta: delta(leadsThisMonth, leadsPreviousMonth),
      sources: Array.from(sourceCounts, ([source, count]) => ({ source, count })).sort(
        (a, b) => b.count - a.count,
      ),
    },
    monthly,
    levels,
    occupancy,
    teacherRanking,
    riskStudents: riskStudents.slice(0, 8),
    upcoming,
    weekdayLoad,
  };
}
