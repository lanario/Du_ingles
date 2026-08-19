"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import type { AdminDashboard } from "@/repositories/dashboard";
import type { FinanceOverview } from "@/repositories/finance";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CountUp,
  DeltaBadge,
  EmptyState,
  Reveal,
  RevealGrid,
  RevealItem,
  ScrollProgressBar,
  SectionTitle,
  formatNumber,
} from "./primitives";
import {
  BarList,
  ColumnChart,
  DonutChart,
  PALETTE,
  RadialGauge,
  Sparkline,
} from "./charts";
import { IncomeStatementPanel, RevenueAreaChart, formatBRL } from "./finance-charts";
import { Icons, KpiCard } from "./kpi-card";

const TZ = "America/Sao_Paulo";

/** Datas formatadas no fuso da escola, não no do navegador — mantém o SSR e a hidratação idênticos. */
function formatDateTime(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "dd/MM · HH:mm", { locale: ptBR });
}

function formatWeekday(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "EEEE", { locale: ptBR });
}

const LEVEL_COLORS = [
  PALETTE.navy,
  PALETTE.navyMid,
  PALETTE.navySoft,
  PALETTE.goldPale,
  PALETTE.goldSoft,
  PALETTE.gold,
];

export function AdminDashboardView({
  data,
  finance,
  organizationName,
}: {
  data: AdminDashboard;
  finance: FinanceOverview;
  organizationName: string;
}) {
  const now = new Date();
  const monthLabel = formatInTimeZone(now, TZ, "MMMM 'de' yyyy", { locale: ptBR });

  const studentTrend = data.monthly.map((m) => m.newStudents);
  const sessionTrend = data.monthly.map((m) => m.sessions);
  const leadTrend = data.monthly.map((m) => m.leads);

  return (
    <div className="pb-4">
      <ScrollProgressBar />

      {/* ---------------------------------------------------------------- */}
      <Reveal className="mb-8" y={16}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">
            {organizationName} · visão consolidada
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-admin-foreground">
            Painel da escola
          </h1>
          <p className="mt-1.5 text-sm text-admin-foreground/60">
            Competência de{" "}
            <span className="font-medium capitalize text-admin-foreground/80">
              {monthLabel}
            </span>{" "}
            · dados atualizados a cada carregamento.
          </p>
        </div>
      </Reveal>

      {/* ---------------------------- KPIs ------------------------------ */}
      <RevealGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <RevealItem>
          <KpiCard
            label="Alunos ativos"
            value={data.students.active}
            icon={Icons.students}
            tone="navy"
            trend={studentTrend}
            changePercent={data.students.delta.changePercent}
            changeLabel="novos alunos vs. mês anterior"
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            label="Alunos pagantes"
            value={data.students.paying}
            icon={Icons.paying}
            tone="gold"
            hint="Com matrícula ativa em turma ativa"
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            label="Professores"
            value={data.teachers.active}
            icon={Icons.teachers}
            tone="navy"
            hint={`${formatNumber(data.teachers.withGroups)} com turma atribuída`}
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            label="Turmas ativas"
            value={data.groups.active}
            icon={Icons.groups}
            tone="navy"
            hint={`${formatNumber(data.groups.seatsOpen)} vagas em aberto`}
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            label="Aulas no mês"
            value={data.sessions.completedThisMonth}
            icon={Icons.sessions}
            tone="gold"
            trend={sessionTrend}
            changePercent={data.sessions.delta.changePercent}
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            label="Frequência média"
            value={data.attendance.rate ?? 0}
            decimals={1}
            suffix="%"
            icon={Icons.attendance}
            tone="navy"
            hint={
              data.attendance.rate === null
                ? "Sem aulas concluídas ainda"
                : `Base: ${formatNumber(data.attendance.sampledSessions)} aula(s) concluída(s)`
            }
          />
        </RevealItem>
      </RevealGrid>

      {/* ------------------------ Faixa secundária ---------------------- */}
      <Reveal className="mt-4">
        <Card className="grid grid-cols-2 divide-admin-border/70 sm:grid-cols-3 sm:divide-x xl:grid-cols-6">
          <MiniStat
            label="Horas ministradas"
            value={data.sessions.hoursThisMonth}
            decimals={1}
            suffix=" h"
            caption="no mês"
          />
          <MiniStat
            label="Aulas em 7 dias"
            value={data.sessions.scheduledNext7Days}
            caption="agendadas"
          />
          <MiniStat
            label="Aulas em andamento"
            value={data.sessions.inProgress}
            caption="agora"
            tone={data.sessions.inProgress > 0 ? "gold" : "neutral"}
          />
          <MiniStat
            label="Tarefas p/ corrigir"
            value={data.assignments.awaitingReview}
            caption={`de ${formatNumber(data.assignments.total)} tarefa(s)`}
            tone={data.assignments.awaitingReview > 0 ? "gold" : "neutral"}
          />
          <MiniStat
            label="Nota média"
            value={data.assignments.averageScore ?? 0}
            decimals={1}
            suffix="%"
            caption={
              data.assignments.averageScore === null
                ? "sem correções"
                : "das entregas corrigidas"
            }
          />
          <MiniStat
            label="Cursos ativos"
            value={data.courses.active}
            caption={`de ${formatNumber(data.courses.total)} cadastrado(s)`}
          />
        </Card>
      </Reveal>

      {/* --------------------- Evolução + medidores --------------------- */}
      <div className="mt-10">
        <SectionTitle hint={`desde ${finance.seriesStartLabel}`}>Evolução</SectionTitle>
        <div className="grid gap-4 xl:grid-cols-3">
          <Reveal className="xl:col-span-2">
            <Card className="h-full">
              <CardHeader
                title="Receita mês a mês"
                subtitle={`Do primeiro mês de ${finance.seriesStartYear} até o mês atual — novos meses entram automaticamente.`}
                action={
                  <div className="text-right">
                    <p className="tabular text-lg font-semibold text-admin-foreground">
                      {formatBRL(finance.windowRevenueCents)}
                    </p>
                    <p className="text-[11px] text-admin-foreground/50">
                      acumulado no período
                    </p>
                  </div>
                }
              />
              <div className="p-4 pt-5">
                {finance.hasEntries ? (
                  <RevenueAreaChart points={finance.revenueSeries} height={260} />
                ) : (
                  <EmptyState>
                    Nenhum lançamento financeiro registrado. Assim que a primeira receita
                    entrar, a curva aparece aqui.
                  </EmptyState>
                )}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.08} className="xl:row-span-2">
            <Card className="h-full">
              <CardHeader
                title="Indicadores de saúde"
                subtitle="Onde a escola está em relação ao ideal."
              />
              <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3 xl:grid-cols-1">
                <RadialGauge
                  value={data.groups.occupancyRate}
                  label="Ocupação"
                  caption={`${formatNumber(data.groups.seatsOpen)} vaga(s) livre(s) nas turmas ativas`}
                  color={PALETTE.gold}
                  size={150}
                />
                <RadialGauge
                  value={data.attendance.rate ?? 0}
                  label="Frequência"
                  caption={`${formatNumber(data.attendance.atRisk)} aluno(s) abaixo de 75%`}
                  color={PALETTE.navy}
                  size={150}
                />
                <RadialGauge
                  value={data.assignments.deliveryRate ?? 0}
                  label="Entrega"
                  caption={
                    data.assignments.deliveryRate === null
                      ? "Nenhuma tarefa publicada ainda"
                      : "Tarefas entregues sobre o esperado"
                  }
                  color={PALETTE.navyMid}
                  size={150}
                />
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.14} className="xl:col-span-2">
            <Card className="h-full">
              <CardHeader
                title={`DRE Simplificado — ${finance.statement.monthLabel}`}
                subtitle="Competência fechada do mês corrente, conta a conta."
              />
              <IncomeStatementPanel statement={finance.statement} />
            </Card>
          </Reveal>
        </div>
      </div>

      {/* ----------------- Nível, carga semanal e captação --------------- */}
      <div className="mt-10">
        <SectionTitle>Composição</SectionTitle>
        <div className="grid gap-4 xl:grid-cols-3">
          <Reveal>
            <Card className="h-full">
              <CardHeader
                title="Alunos por nível CEFR"
                subtitle="Distribuição declarada no perfil do aluno."
              />
              <div className="p-5">
                {data.levels.every((l) => l.students === 0) ? (
                  <EmptyState>Nenhum aluno com nível cadastrado.</EmptyState>
                ) : (
                  <DonutChart
                    slices={data.levels.map((level, index) => ({
                      label: level.level,
                      value: level.students,
                      color: LEVEL_COLORS[index] ?? PALETTE.navy,
                    }))}
                    centerValue={formatNumber(
                      data.levels.reduce((sum, l) => sum + l.students, 0),
                    )}
                    centerLabel="alunos"
                    size={180}
                  />
                )}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.06}>
            <Card className="h-full">
              <CardHeader
                title="Carga por dia da semana"
                subtitle="Todas as aulas agendadas e realizadas."
              />
              <div className="p-5">
                {data.weekdayLoad.every((d) => d.sessions === 0) ? (
                  <EmptyState>Nenhuma aula na agenda.</EmptyState>
                ) : (
                  <ColumnChart
                    data={data.weekdayLoad.map((d) => ({
                      label: d.label,
                      value: d.sessions,
                    }))}
                    height={190}
                  />
                )}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.12}>
            <Card className="h-full">
              <CardHeader
                title="Captação"
                subtitle="Leads do site por origem."
                action={
                  <div className="text-right">
                    <p className="tabular text-lg font-semibold text-admin-foreground">
                      <CountUp value={data.leads.thisMonth} />
                    </p>
                    <p className="text-[11px] text-admin-foreground/50">no mês</p>
                  </div>
                }
              />
              <div className="space-y-4 p-5">
                <DeltaBadge changePercent={data.leads.delta.changePercent} />
                {data.leads.sources.length === 0 ? (
                  <EmptyState>Nenhum lead registrado.</EmptyState>
                ) : (
                  <BarList
                    rows={data.leads.sources.map((source) => ({
                      label: source.source,
                      value: source.count,
                    }))}
                  />
                )}
                <div>
                  <p className="mb-1 text-xs text-admin-foreground/50">
                    Últimos 12 meses · {formatNumber(data.leads.total)} lead(s) no total
                  </p>
                  <Sparkline values={leadTrend} color={PALETTE.gold} />
                </div>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      {/* --------------------- Turmas e professores ---------------------- */}
      <div className="mt-10">
        <SectionTitle>Turmas e professores</SectionTitle>
        <div className="grid gap-4 xl:grid-cols-2">
          <Reveal>
            <Card className="h-full">
              <CardHeader
                title="Ocupação das turmas"
                subtitle="Matrículas ativas sobre a capacidade cadastrada."
                action={
                  <Link
                    href="/admin/turmas"
                    className="text-xs font-medium text-navy-700 underline-offset-4 hover:underline"
                  >
                    Ver turmas
                  </Link>
                }
              />
              <div className="p-5">
                {data.occupancy.length === 0 ? (
                  <EmptyState>Nenhuma turma ativa.</EmptyState>
                ) : (
                  <BarList
                    max={100}
                    rows={data.occupancy.slice(0, 8).map((group) => ({
                      label: group.name,
                      sublabel: `${group.level} · ${group.teacherName}`,
                      value: group.occupancyRate,
                      display: `${group.enrolled}/${group.maxStudents}`,
                      color:
                        group.occupancyRate >= 90
                          ? `linear-gradient(90deg, ${PALETTE.gold}, ${PALETTE.goldSoft})`
                          : undefined,
                    }))}
                  />
                )}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.06}>
            <Card className="h-full">
              <CardHeader
                title="Desempenho dos professores"
                subtitle="Aulas concluídas, horas e alcance de alunos."
              />
              <div className="overflow-x-auto">
                {data.teacherRanking.length === 0 ? (
                  <div className="p-5">
                    <EmptyState>Nenhum professor ativo.</EmptyState>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-admin-border/70 text-left text-[11px] uppercase tracking-wide text-admin-foreground/50">
                        <th className="px-5 py-2.5 font-medium">Professor</th>
                        <th className="px-3 py-2.5 text-right font-medium">Turmas</th>
                        <th className="px-3 py-2.5 text-right font-medium">Alunos</th>
                        <th className="px-3 py-2.5 text-right font-medium">Aulas</th>
                        <th className="px-5 py-2.5 text-right font-medium">Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.teacherRanking.slice(0, 8).map((teacher, index) => (
                        <tr
                          key={teacher.teacherId}
                          className="border-b border-admin-border/50 last:border-0 transition-colors hover:bg-navy-50/60"
                        >
                          <td className="px-5 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-semibold",
                                  index === 0
                                    ? "bg-gold-100 text-gold-700"
                                    : "bg-admin-muted text-admin-foreground/60",
                                )}
                              >
                                {index + 1}
                              </span>
                              <span className="truncate font-medium text-admin-foreground">
                                {teacher.name}
                              </span>
                            </span>
                          </td>
                          <td className="tabular px-3 py-2.5 text-right text-admin-foreground/70">
                            {teacher.groups}
                          </td>
                          <td className="tabular px-3 py-2.5 text-right text-admin-foreground/70">
                            {teacher.students}
                          </td>
                          <td className="tabular px-3 py-2.5 text-right font-medium text-admin-foreground">
                            {teacher.sessionsCompleted}
                          </td>
                          <td className="tabular px-5 py-2.5 text-right text-admin-foreground/70">
                            {formatNumber(teacher.hours, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      {/* ------------------------ Agenda e riscos ------------------------ */}
      <div className="mt-10">
        <SectionTitle>Acompanhamento</SectionTitle>
        <div className="grid gap-4 xl:grid-cols-2">
          <Reveal>
            <Card className="h-full">
              <CardHeader
                title="Próximas aulas"
                subtitle="As seis mais próximas de toda a escola."
              />
              <div className="p-2">
                {data.upcoming.length === 0 ? (
                  <div className="p-3">
                    <EmptyState>Nenhuma aula agendada.</EmptyState>
                  </div>
                ) : (
                  <ul className="divide-y divide-admin-border/60">
                    {data.upcoming.map((session) => (
                      <li
                        key={session.id}
                        className="flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-navy-50/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-admin-foreground">
                            {session.title}
                          </p>
                          <p className="truncate text-xs text-admin-foreground/55">
                            {session.groupName} · {session.teacherName}
                          </p>
                        </div>
                        <div className="flex-none text-right">
                          <p className="tabular text-sm font-medium text-admin-foreground">
                            {formatDateTime(session.scheduledAt)}
                          </p>
                          <p className="text-xs capitalize text-admin-foreground/50">
                            {formatWeekday(session.scheduledAt)} ·{" "}
                            {session.durationMinutes} min
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.06}>
            <Card className="h-full">
              <CardHeader
                title="Alunos em risco"
                subtitle="Frequência abaixo de 75% na turma."
                action={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    <span aria-hidden>{Icons.risk}</span>
                    {formatNumber(data.attendance.atRisk)}
                  </span>
                }
              />
              <div className="p-2">
                {data.riskStudents.length === 0 ? (
                  <div className="p-3">
                    <EmptyState>
                      Nenhum aluno abaixo do corte de frequência. 🎉
                    </EmptyState>
                  </div>
                ) : (
                  <ul className="divide-y divide-admin-border/60">
                    {data.riskStudents.map((student) => (
                      <li
                        key={`${student.groupName}:${student.studentId}`}
                        className="flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-navy-50/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-admin-foreground">
                            {student.name}
                          </p>
                          <p className="truncate text-xs text-admin-foreground/55">
                            {student.groupName} · {student.sessionsMissed} falta(s)
                          </p>
                        </div>
                        <span
                          className={cn(
                            "tabular flex-none rounded-full px-2.5 py-1 text-xs font-semibold",
                            student.attendanceRate < 50
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700",
                          )}
                        >
                          {formatNumber(student.attendanceRate, 1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  caption,
  decimals = 0,
  suffix = "",
  tone = "neutral",
}: {
  label: string;
  value: number;
  caption: string;
  decimals?: number;
  suffix?: string;
  tone?: "neutral" | "gold";
}) {
  return (
    <div className="border-b border-admin-border/70 px-5 py-4 last:border-b-0 sm:border-b-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-admin-foreground/45">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold",
          tone === "gold" ? "text-gold-700" : "text-admin-foreground",
        )}
      >
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </p>
      <p className="mt-0.5 text-xs text-admin-foreground/50">{caption}</p>
    </div>
  );
}
