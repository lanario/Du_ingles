import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { categoryOf, type FinanceKind } from "@/schemas/finance";
import { DEFAULT_REPORT_WINDOW, type ReportWindow } from "@/schemas/reports";
import {
  currentMonthKey,
  monthBounds,
  monthLabel,
  monthTitle,
  shiftMonth,
  todayInSchoolTz,
} from "@/repositories/finance";

/**
 * Relatório financeiro da escola: despesas × receitas, receita por aluno e
 * folha de professores.
 *
 * Três decisões estruturam o arquivo:
 *
 * 1. **A origem do dinheiro continua sendo `finance_entries`.** Nada aqui
 *    inventa uma segunda contabilidade: o relatório é uma *leitura* do
 *    livro-caixa, pela mesma competência (`occurred_on`) que fecha o DRE do
 *    painel. Assinatura da Stripe entra só como contexto do aluno (plano e
 *    status), nunca somada à receita — senão a mensalidade lançada no caixa
 *    seria contada duas vezes.
 *
 * 2. **A ligação lançamento → pessoa é por `counterparty`.** A tabela guarda
 *    a contraparte como texto livre (0025) porque nem todo fornecedor é
 *    alguém cadastrado. Para o relatório, o texto é normalizado (sem acento,
 *    minúsculo) e cruzado com os nomes da organização; o que não casa não é
 *    escondido — vira a linha "Não identificado", que é o sinal de que falta
 *    disciplina no preenchimento.
 *
 * 3. **A janela é uma série, o detalhe é um mês.** Os gráficos leem N meses
 *    (3/6/12) para mostrar tendência; as tabelas de aluno e professor leem só
 *    a competência selecionada, porque a pergunta ali é sempre "quem pagou e
 *    quanto custou *neste* mês".
 */

export interface ReportMonthPoint {
  /** `yyyy-MM`. */
  key: string;
  /** Rótulo curto do eixo: `ago`. */
  label: string;
  /** Rótulo completo do tooltip: `Agosto de 2026`. */
  title: string;
  revenueCents: number;
  /** Custo com professores e coordenação. */
  professionalCostCents: number;
  /** Estrutura: aluguel, software, marketing, impostos. */
  operatingExpenseCents: number;
  /** Soma das duas saídas. */
  expenseCents: number;
  netCents: number;
}

export interface ReportTotals {
  revenueCents: number;
  professionalCostCents: number;
  operatingExpenseCents: number;
  expenseCents: number;
  netCents: number;
  /** Resultado sobre receita. `null` quando não houve receita. */
  marginPercent: number | null;
  revenuePaidCents: number;
  revenueOpenCents: number;
  revenueOverdueCents: number;
  expensePaidCents: number;
  expenseOpenCents: number;
  expenseOverdueCents: number;
  revenueCount: number;
  expenseCount: number;
}

export interface ReportCategorySlice {
  id: string;
  label: string;
  kind: FinanceKind;
  cents: number;
  /** Fatia sobre o total da direção, de 0 a 1. */
  share: number;
  count: number;
}

export interface StudentRevenueRow {
  /** `null` quando a contraparte não casou com nenhum aluno cadastrado. */
  studentId: string | null;
  name: string;
  cents: number;
  paidCents: number;
  openCents: number;
  overdueCents: number;
  count: number;
  /** Última baixa registrada no mês (`yyyy-MM-dd`). */
  lastPaidOn: string | null;
  /** Plano assinado, quando o aluno tem assinatura na plataforma. */
  planName: string | null;
  subscriptionActive: boolean;
  /** Fatia sobre a receita do mês, de 0 a 1. */
  share: number;
  identified: boolean;
}

export interface StudentRevenueSummary {
  identifiedCents: number;
  unidentifiedCents: number;
  /** Alunos distintos com receita no mês. */
  payingStudents: number;
  activeSubscriptions: number;
  /** Receita identificada dividida pelos alunos pagantes. */
  averageTicketCents: number | null;
  /** Peso do maior pagador sobre a receita do mês — concentração de risco. */
  topShare: number | null;
}

export interface TeacherPayrollRow {
  teacherId: string | null;
  name: string;
  cents: number;
  paidCents: number;
  openCents: number;
  count: number;
  /** Aulas concluídas na competência. */
  sessions: number;
  minutes: number;
  /** Valor-hora cadastrado no perfil, em centavos. */
  hourlyRateCents: number | null;
  /** Valor-hora × horas ministradas: o que o cadastro previa pagar. */
  estimatedCents: number | null;
  costPerSessionCents: number | null;
  costPerHourCents: number | null;
  /** Fatia sobre a folha do mês, de 0 a 1. */
  share: number;
  identified: boolean;
}

export interface PayrollSummary {
  totalCents: number;
  /** Folha sobre receita do mês — o indicador que decide reajuste. */
  shareOfRevenue: number | null;
  sessions: number;
  minutes: number;
  averageCostPerHourCents: number | null;
  teachersPaid: number;
  /** Professores com aula dada no mês e nenhum lançamento de custo. */
  teachersWithoutEntry: number;
}

export interface FinancialReport {
  monthKey: string;
  monthTitle: string;
  previousKey: string;
  nextKey: string;
  currentKey: string;
  today: string;
  windowMonths: ReportWindow;
  series: ReportMonthPoint[];
  totals: ReportTotals;
  /** Competência anterior, só para as variações do topo. */
  previousTotals: ReportTotals;
  /** Acumulado da janela inteira. */
  windowTotals: ReportTotals;
  revenueCategories: ReportCategorySlice[];
  expenseCategories: ReportCategorySlice[];
  students: StudentRevenueRow[];
  studentSummary: StudentRevenueSummary;
  teachers: TeacherPayrollRow[];
  payrollSummary: PayrollSummary;
  /** `false` quando não há nenhum lançamento na janela — habilita o estado vazio. */
  hasEntries: boolean;
}

// ---------------------------------------------------------------------------
// Cruzamento nome ↔ contraparte
// ---------------------------------------------------------------------------

/** `José da Silva ` → `jose da silva`: acento e caixa não podem separar pessoas. */
function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface PersonRef {
  id: string;
  fullName: string;
  tokens: string[];
}

/**
 * Acha a pessoa por trás de uma contraparte digitada à mão.
 *
 * Primeiro o casamento exato do nome normalizado — que cobre o caso comum de
 * o admin ter copiado o nome do cadastro. Só depois a busca por tokens, que
 * resolve "Mensalidade — Ana Paula Souza" e "ana paula souza (turma B1)".
 * Nomes de uma palavra só ficam fora do fallback: "Ana" casaria com qualquer
 * lançamento que mencione Ana.
 */
function matchPerson(counterparty: string, people: PersonRef[]): PersonRef | null {
  const needle = normalizeName(counterparty);
  if (!needle) return null;

  for (const person of people) {
    if (normalizeName(person.fullName) === needle) return person;
  }

  const words = new Set(needle.split(" "));
  let best: PersonRef | null = null;
  for (const person of people) {
    if (person.tokens.length < 2) continue;
    if (person.tokens.every((token) => words.has(token))) {
      // Mais tokens = casamento mais específico; "Ana Souza" perde para
      // "Ana Paula Souza" quando os dois cabem no mesmo texto.
      if (!best || person.tokens.length > best.tokens.length) best = person;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Agregação
// ---------------------------------------------------------------------------

interface EntryRow {
  kind: FinanceKind;
  category: string;
  amount_cents: number | string;
  occurred_on: string;
  due_on: string;
  status: "pending" | "paid";
  paid_on: string | null;
  counterparty: string | null;
  description: string;
}

function emptyTotals(): ReportTotals {
  return {
    revenueCents: 0,
    professionalCostCents: 0,
    operatingExpenseCents: 0,
    expenseCents: 0,
    netCents: 0,
    marginPercent: null,
    revenuePaidCents: 0,
    revenueOpenCents: 0,
    revenueOverdueCents: 0,
    expensePaidCents: 0,
    expenseOpenCents: 0,
    expenseOverdueCents: 0,
    revenueCount: 0,
    expenseCount: 0,
  };
}

/** Soma um conjunto de lançamentos numa passada só. */
function summarize(rows: EntryRow[], today: string): ReportTotals {
  const totals = emptyTotals();

  for (const row of rows) {
    const amount = Number(row.amount_cents);
    const open = row.status === "pending";
    const overdue = open && row.due_on < today;

    if (row.kind === "revenue") {
      totals.revenueCents += amount;
      totals.revenueCount += 1;
      if (open) totals.revenueOpenCents += amount;
      else totals.revenuePaidCents += amount;
      if (overdue) totals.revenueOverdueCents += amount;
      continue;
    }

    if (row.kind === "professional_cost") totals.professionalCostCents += amount;
    else totals.operatingExpenseCents += amount;

    totals.expenseCents += amount;
    totals.expenseCount += 1;
    if (open) totals.expenseOpenCents += amount;
    else totals.expensePaidCents += amount;
    if (overdue) totals.expenseOverdueCents += amount;
  }

  totals.netCents = totals.revenueCents - totals.expenseCents;
  totals.marginPercent =
    totals.revenueCents > 0
      ? Math.round((1000 * totals.netCents) / totals.revenueCents) / 10
      : null;

  return totals;
}

/** Quebra por linha de negócio, da maior para a menor. */
function sliceByCategory(rows: EntryRow[]): ReportCategorySlice[] {
  const buckets = new Map<string, ReportCategorySlice>();
  let sum = 0;

  for (const row of rows) {
    const amount = Number(row.amount_cents);
    const meta = categoryOf(row.category, row.kind);
    const slice = buckets.get(row.category) ?? {
      id: row.category,
      label: meta.label,
      kind: row.kind,
      cents: 0,
      share: 0,
      count: 0,
    };
    slice.cents += amount;
    slice.count += 1;
    buckets.set(row.category, slice);
    sum += amount;
  }

  return Array.from(buckets.values())
    .map((slice) => ({ ...slice, share: sum > 0 ? slice.cents / sum : 0 }))
    .sort((a, b) => b.cents - a.cents);
}

/** Hora cadastrada no perfil vem em reais (`numeric`); o relatório fala centavos. */
function hourlyRateToCents(rate: number | null): number | null {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(rate * 100);
}

/**
 * Relatório financeiro de uma competência, com a série dos N meses anteriores.
 *
 * Usa o client service-role pelo mesmo contrato do resto do financeiro: a
 * página chamadora já passou por `requireRole(["admin"])` e toda query é
 * explicitamente escopada por `organization_id`.
 */
export async function getFinancialReport(
  organizationId: string,
  monthKey: string,
  windowMonths: ReportWindow = DEFAULT_REPORT_WINDOW,
): Promise<FinancialReport> {
  const admin = createAdminSupabaseClient();

  const today = todayInSchoolTz();
  const startKey = shiftMonth(monthKey, -(windowMonths - 1));
  const previousKey = shiftMonth(monthKey, -1);
  const bounds = monthBounds(monthKey);
  // A janela precisa do mês anterior ao primeiro ponto para calcular a
  // variação sem uma segunda ida ao banco.
  const windowStart = `${shiftMonth(startKey, -1)}-01`;

  const [
    { data: entries },
    { data: people },
    { data: subscriptions },
    { data: sessions },
    { data: teacherProfiles },
  ] = await Promise.all([
    admin
      .from("finance_entries")
      .select(
        "kind, category, amount_cents, occurred_on, due_on, status, paid_on, counterparty, description",
      )
      .eq("organization_id", organizationId)
      .gte("occurred_on", windowStart)
      .lte("occurred_on", monthBounds(monthKey).last),
    admin
      .from("profiles")
      .select("id, full_name, role")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("role", ["student", "teacher"]),
    admin
      .from("student_subscriptions")
      .select("student_id, status, plan:plan_id(name)")
      .eq("organization_id", organizationId),
    admin
      .from("class_sessions")
      .select("teacher_id, duration_minutes, scheduled_at")
      .eq("organization_id", organizationId)
      .eq("status", "completed")
      .gte("scheduled_at", `${bounds.first}T00:00:00Z`)
      .lte("scheduled_at", `${bounds.last}T23:59:59Z`),
    admin
      .from("teacher_profiles")
      .select("profile_id, hourly_rate")
      .eq("organization_id", organizationId),
  ]);

  const rows = (entries ?? []) as EntryRow[];

  // -------------------------------------------------------------------------
  // Série mensal
  // -------------------------------------------------------------------------
  const byMonth = new Map<string, ReportMonthPoint>();
  const series: ReportMonthPoint[] = Array.from({ length: windowMonths }, (_, index) => {
    const key = shiftMonth(startKey, index);
    const point: ReportMonthPoint = {
      key,
      label: monthLabel(key, "LLL"),
      title: monthTitle(key),
      revenueCents: 0,
      professionalCostCents: 0,
      operatingExpenseCents: 0,
      expenseCents: 0,
      netCents: 0,
    };
    byMonth.set(key, point);
    return point;
  });

  const monthRows: EntryRow[] = [];
  const previousRows: EntryRow[] = [];
  const windowRows: EntryRow[] = [];

  for (const row of rows) {
    const key = row.occurred_on.slice(0, 7);
    const amount = Number(row.amount_cents);

    const point = byMonth.get(key);
    if (point) {
      if (row.kind === "revenue") point.revenueCents += amount;
      else if (row.kind === "professional_cost") point.professionalCostCents += amount;
      else point.operatingExpenseCents += amount;
      windowRows.push(row);
    }

    if (key === monthKey) monthRows.push(row);
    else if (key === previousKey) previousRows.push(row);
  }

  for (const point of series) {
    point.expenseCents = point.professionalCostCents + point.operatingExpenseCents;
    point.netCents = point.revenueCents - point.expenseCents;
  }

  // -------------------------------------------------------------------------
  // Pessoas
  // -------------------------------------------------------------------------
  const students: PersonRef[] = [];
  const teachers: PersonRef[] = [];
  for (const person of people ?? []) {
    const ref: PersonRef = {
      id: person.id,
      fullName: person.full_name,
      tokens: normalizeName(person.full_name).split(" ").filter(Boolean),
    };
    if (person.role === "student") students.push(ref);
    else teachers.push(ref);
  }

  const subscriptionByStudent = new Map<
    string,
    { planName: string | null; active: boolean }
  >();
  for (const sub of subscriptions ?? []) {
    const active = sub.status === "active" || sub.status === "trialing";
    const current = subscriptionByStudent.get(sub.student_id);
    // Uma assinatura ativa sempre prevalece sobre um histórico cancelado.
    if (!current || (active && !current.active)) {
      subscriptionByStudent.set(sub.student_id, {
        planName: sub.plan?.name ?? null,
        active,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Receita por aluno
  // -------------------------------------------------------------------------
  const revenueRows = monthRows.filter((row) => row.kind === "revenue");
  const studentBuckets = new Map<string, StudentRevenueRow>();

  for (const row of revenueRows) {
    const amount = Number(row.amount_cents);
    const match = row.counterparty ? matchPerson(row.counterparty, students) : null;
    const id = match?.id ?? "__unmatched__";
    const bucket =
      studentBuckets.get(id) ??
      ({
        studentId: match?.id ?? null,
        name: match?.fullName ?? "Não identificado",
        cents: 0,
        paidCents: 0,
        openCents: 0,
        overdueCents: 0,
        count: 0,
        lastPaidOn: null,
        planName: null,
        subscriptionActive: false,
        share: 0,
        identified: Boolean(match),
      } satisfies StudentRevenueRow);

    bucket.cents += amount;
    bucket.count += 1;
    if (row.status === "paid") {
      bucket.paidCents += amount;
      if (row.paid_on && (!bucket.lastPaidOn || row.paid_on > bucket.lastPaidOn)) {
        bucket.lastPaidOn = row.paid_on;
      }
    } else {
      bucket.openCents += amount;
      if (row.due_on < today) bucket.overdueCents += amount;
    }

    studentBuckets.set(id, bucket);
  }

  const monthRevenueCents = revenueRows.reduce(
    (sum, row) => sum + Number(row.amount_cents),
    0,
  );

  const studentRows = Array.from(studentBuckets.values())
    .map((row) => {
      const subscription = row.studentId
        ? subscriptionByStudent.get(row.studentId)
        : undefined;
      return {
        ...row,
        planName: subscription?.planName ?? null,
        subscriptionActive: subscription?.active ?? false,
        share: monthRevenueCents > 0 ? row.cents / monthRevenueCents : 0,
      };
    })
    // "Não identificado" desce para o fim: é ruído de cadastro, não um pagador.
    .sort((a, b) => {
      if (a.identified !== b.identified) return a.identified ? -1 : 1;
      return b.cents - a.cents;
    });

  const identifiedRows = studentRows.filter((row) => row.identified);
  const identifiedCents = identifiedRows.reduce((sum, row) => sum + row.cents, 0);

  const studentSummary: StudentRevenueSummary = {
    identifiedCents,
    unidentifiedCents: monthRevenueCents - identifiedCents,
    payingStudents: identifiedRows.length,
    activeSubscriptions: Array.from(subscriptionByStudent.values()).filter(
      (sub) => sub.active,
    ).length,
    averageTicketCents:
      identifiedRows.length > 0
        ? Math.round(identifiedCents / identifiedRows.length)
        : null,
    topShare: identifiedRows[0]?.share ?? null,
  };

  // -------------------------------------------------------------------------
  // Folha de professores
  // -------------------------------------------------------------------------
  const rateByTeacher = new Map<string, number | null>();
  for (const profile of teacherProfiles ?? []) {
    rateByTeacher.set(profile.profile_id, hourlyRateToCents(profile.hourly_rate));
  }

  const teacherBuckets = new Map<string, TeacherPayrollRow>();

  function teacherBucket(id: string, name: string, identified: boolean) {
    const existing = teacherBuckets.get(id);
    if (existing) return existing;
    const created: TeacherPayrollRow = {
      teacherId: identified ? id : null,
      name,
      cents: 0,
      paidCents: 0,
      openCents: 0,
      count: 0,
      sessions: 0,
      minutes: 0,
      hourlyRateCents: identified ? (rateByTeacher.get(id) ?? null) : null,
      estimatedCents: null,
      costPerSessionCents: null,
      costPerHourCents: null,
      share: 0,
      identified,
    };
    teacherBuckets.set(id, created);
    return created;
  }

  for (const row of monthRows) {
    if (row.kind !== "professional_cost") continue;
    const amount = Number(row.amount_cents);
    const match = row.counterparty ? matchPerson(row.counterparty, teachers) : null;
    const bucket = match
      ? teacherBucket(match.id, match.fullName, true)
      : teacherBucket("__unmatched__", "Não identificado", false);

    bucket.cents += amount;
    bucket.count += 1;
    if (row.status === "paid") bucket.paidCents += amount;
    else bucket.openCents += amount;
  }

  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  for (const session of sessions ?? []) {
    const teacher = teacherById.get(session.teacher_id);
    if (!teacher) continue;
    const bucket = teacherBucket(teacher.id, teacher.fullName, true);
    bucket.sessions += 1;
    bucket.minutes += session.duration_minutes ?? 0;
  }

  const payrollCents = Array.from(teacherBuckets.values()).reduce(
    (sum, row) => sum + row.cents,
    0,
  );

  const teacherRows = Array.from(teacherBuckets.values())
    .map((row) => {
      const hours = row.minutes / 60;
      return {
        ...row,
        estimatedCents:
          row.hourlyRateCents != null && hours > 0
            ? Math.round(row.hourlyRateCents * hours)
            : null,
        costPerSessionCents:
          row.sessions > 0 && row.cents > 0 ? Math.round(row.cents / row.sessions) : null,
        costPerHourCents: hours > 0 && row.cents > 0 ? Math.round(row.cents / hours) : null,
        share: payrollCents > 0 ? row.cents / payrollCents : 0,
      };
    })
    .sort((a, b) => {
      if (a.identified !== b.identified) return a.identified ? -1 : 1;
      if (b.cents !== a.cents) return b.cents - a.cents;
      return b.sessions - a.sessions;
    });

  const totalMinutes = teacherRows.reduce((sum, row) => sum + row.minutes, 0);
  const totals = summarize(monthRows, today);

  const payrollSummary: PayrollSummary = {
    totalCents: totals.professionalCostCents,
    shareOfRevenue:
      totals.revenueCents > 0 ? totals.professionalCostCents / totals.revenueCents : null,
    sessions: teacherRows.reduce((sum, row) => sum + row.sessions, 0),
    minutes: totalMinutes,
    averageCostPerHourCents:
      totalMinutes > 0 && payrollCents > 0
        ? Math.round(payrollCents / (totalMinutes / 60))
        : null,
    teachersPaid: teacherRows.filter((row) => row.identified && row.cents > 0).length,
    teachersWithoutEntry: teacherRows.filter(
      (row) => row.identified && row.sessions > 0 && row.cents === 0,
    ).length,
  };

  return {
    monthKey,
    monthTitle: monthTitle(monthKey),
    previousKey,
    nextKey: shiftMonth(monthKey, 1),
    currentKey: currentMonthKey(),
    today,
    windowMonths,
    series,
    totals,
    previousTotals: summarize(previousRows, today),
    windowTotals: summarize(windowRows, today),
    revenueCategories: sliceByCategory(revenueRows),
    expenseCategories: sliceByCategory(
      monthRows.filter((row) => row.kind !== "revenue"),
    ),
    students: studentRows,
    studentSummary,
    teachers: teacherRows,
    payrollSummary,
    hasEntries: rows.length > 0,
  };
}
