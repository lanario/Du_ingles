"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CountUp,
  Reveal,
  RevealGrid,
  RevealItem,
} from "@/components/features/admin/dashboard/primitives";
import { RadialGauge, PALETTE } from "@/components/features/admin/dashboard/charts";

const TZ = "America/Sao_Paulo";

export interface DashboardSession {
  id: string;
  title: string;
  groupName: string;
  scheduledAt: string;
  durationMinutes: number;
}

export interface DashboardTask {
  id: string;
  title: string;
  groupName: string;
  dueAt: string | null;
  status: string;
}

export interface DashboardGroupProgress {
  groupId: string;
  groupName: string;
  attendanceRate: number;
}

export interface DashboardGrade {
  title: string;
  groupName: string;
  score: number | null;
  maxScore: number | null;
}

export interface StudentDashboardData {
  firstName: string;
  currentLevel: string | null;
  completedSessions: number;
  pendingTasks: number;
  averageGrade: number | null;
  overallAttendance: number | null;
  sessions: DashboardSession[];
  tasks: DashboardTask[];
  groups: DashboardGroupProgress[];
  grades: DashboardGrade[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  submitted: "Entregue",
  graded: "Corrigida",
  late: "Atrasada",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-gold-50 text-gold-700",
  submitted: "bg-navy-50 text-navy-700",
  graded: "bg-emerald-50 text-emerald-700",
  late: "bg-red-50 text-red-700",
};

function formatDate(iso: string, pattern: string) {
  return formatInTimeZone(new Date(iso), TZ, pattern, { locale: ptBR });
}

/**
 * Painel do aluno. Mesmas primitivas de animação do painel admin, mas com o
 * chrome claro da área logada — a diferença entre os dois contextos está no
 * shell (branco vs. navy) e não em duas linguagens visuais separadas.
 */
export function StudentDashboard({ data }: { data: StudentDashboardData }) {
  const reduced = useReducedMotion();
  const nextSession = data.sessions[0];

  const now = Date.now();
  const sessionStart = nextSession ? new Date(nextSession.scheduledAt).getTime() : null;
  const sessionEnd =
    sessionStart !== null && nextSession
      ? sessionStart + nextSession.durationMinutes * 60_000
      : null;
  const isLive = sessionStart !== null && sessionEnd !== null && now >= sessionStart && now <= sessionEnd;

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal y={16}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">
              Área do aluno
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy-900">
              Olá, {data.firstName} 👋
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {nextSession
                ? `Sua próxima aula é ${formatDate(nextSession.scheduledAt, "EEEE',' dd/MM 'às' HH:mm")}.`
                : "Você ainda não tem aulas agendadas."}
            </p>
          </div>
          {data.currentLevel && (
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-300 bg-gold-50 px-3.5 py-1.5 text-sm font-medium text-gold-700">
              Nível atual
              <span className="rounded-full bg-navy-900 px-2 py-0.5 text-xs font-semibold text-gold-300">
                {data.currentLevel}
              </span>
            </span>
          )}
        </div>
      </Reveal>

      {/* Destaque: próxima aula */}
      <Reveal className="mt-7">
        <motion.div
          whileHover={reduced ? undefined : { y: -3 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="relative overflow-hidden rounded-2xl bg-navy-900 p-6 text-white shadow-[0_20px_50px_-30px_rgba(10,31,68,0.9)]"
        >
          <span
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600"
            aria-hidden
          />
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300">
                  Próxima aula
                </p>
                {isLive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                    <span className="relative flex h-2 w-2 flex-none">
                      <span className="live-dot absolute inset-0 rounded-full" aria-hidden />
                      <span className="relative h-2 w-2 rounded-full bg-success" />
                    </span>
                    Ao vivo
                  </span>
                )}
              </div>
              {nextSession ? (
                <>
                  <p className="mt-2 text-xl font-semibold">{nextSession.title}</p>
                  <p className="mt-1 text-sm text-white/65">
                    {nextSession.groupName} · {nextSession.durationMinutes} min
                  </p>
                </>
              ) : (
                <p className="mt-2 text-lg text-white/70">
                  Nenhuma aula agendada por enquanto.
                </p>
              )}
            </div>

            {nextSession && (
              <div className="text-right">
                <p className="tabular text-4xl font-semibold tracking-tight">
                  {formatDate(nextSession.scheduledAt, "HH:mm")}
                </p>
                <p className="mt-1 text-sm capitalize text-gold-300">
                  {formatDate(nextSession.scheduledAt, "EEEE',' dd 'de' MMMM")}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </Reveal>

      {/* KPIs do aluno */}
      <RevealGrid className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        <RevealItem>
          <StatCard
            label="Aulas concluídas"
            value={data.completedSessions}
            caption="com presença registrada"
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Tarefas pendentes"
            value={data.pendingTasks}
            caption="aguardando sua entrega"
            tone={data.pendingTasks > 0 ? "gold" : "navy"}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Frequência"
            value={data.overallAttendance}
            decimals={1}
            suffix="%"
            caption={
              data.overallAttendance === null
                ? "sem turmas ainda"
                : "média nas suas turmas"
            }
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Nota média"
            value={data.averageGrade}
            decimals={1}
            suffix="%"
            caption={
              data.averageGrade === null
                ? "sem correções ainda"
                : "das tarefas corrigidas"
            }
          />
        </RevealItem>
      </RevealGrid>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {/* Agenda */}
        <Reveal className="md:col-span-2">
          <Panel
            title="Próximas aulas"
            action={
              <Link
                href="/tarefas"
                className="text-xs font-medium text-navy-700 underline-offset-4 hover:underline"
              >
                Ver tarefas
              </Link>
            }
          >
            {data.sessions.length === 0 ? (
              <Empty>Nenhuma aula agendada ainda.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {data.sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-muted/70"
                  >
                    <div className="flex h-12 w-12 flex-none flex-col items-center justify-center rounded-xl border border-border bg-muted">
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {formatDate(session.scheduledAt, "MMM")}
                      </span>
                      <span className="tabular text-sm font-semibold text-navy-900">
                        {formatDate(session.scheduledAt, "dd")}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {session.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.groupName} · {session.durationMinutes} min
                      </p>
                    </div>
                    <span className="tabular flex-none text-sm font-medium text-navy-800">
                      {formatDate(session.scheduledAt, "HH:mm")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>

        {/* Frequência por turma */}
        <Reveal delay={0.06}>
          <Panel title="Sua frequência">
            {data.groups.length === 0 ? (
              <Empty>Você ainda não está em uma turma.</Empty>
            ) : (
              <div className="space-y-5 px-3 py-2">
                <RadialGauge
                  value={data.overallAttendance ?? 0}
                  label="Geral"
                  color={PALETTE.gold}
                  size={140}
                />
                <ul className="space-y-3">
                  {data.groups.map((group) => (
                    <li key={group.groupId}>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm text-foreground/85">
                          {group.groupName}
                        </span>
                        <span className="tabular text-sm font-semibold text-navy-900">
                          {group.attendanceRate.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className={cn(
                            "relative h-full overflow-hidden rounded-full",
                            group.attendanceRate < 75
                              ? "bg-gradient-to-r from-red-500 to-red-400"
                              : "bg-gradient-to-r from-navy-800 to-navy-500",
                          )}
                          initial={reduced ? false : { width: 0 }}
                          whileInView={{
                            width: `${Math.min(100, group.attendanceRate)}%`,
                          }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                        >
                          {!reduced && (
                            <span aria-hidden className="progress-shimmer absolute inset-0 rounded-full" />
                          )}
                        </motion.div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </Reveal>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Reveal>
          <Panel title="Tarefas em aberto">
            {data.tasks.length === 0 ? (
              <Empty>Nenhuma tarefa pendente. 🎉</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {data.tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/tarefas/${task.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-muted/70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {task.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {task.groupName}
                          {task.dueAt &&
                            ` · entrega ${formatDate(task.dueAt, "dd/MM 'às' HH:mm")}`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "flex-none rounded-full px-2.5 py-1 text-xs font-medium",
                          STATUS_TONE[task.status] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {STATUS_LABEL[task.status] ?? task.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={0.06}>
          <Panel
            title="Últimas notas"
            action={
              <Link
                href="/progresso"
                className="text-xs font-medium text-navy-700 underline-offset-4 hover:underline"
              >
                Meu progresso
              </Link>
            }
          >
            {data.grades.length === 0 ? (
              <Empty>Nenhuma tarefa corrigida ainda.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {data.grades.map((grade, index) => {
                  const percent =
                    grade.score !== null && grade.maxScore
                      ? (100 * grade.score) / grade.maxScore
                      : null;
                  return (
                    <li
                      key={`${grade.title}-${index}`}
                      className="flex items-center justify-between gap-4 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {grade.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {grade.groupName}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "tabular flex-none rounded-lg px-2.5 py-1 text-sm font-semibold",
                          percent !== null && percent >= 70
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gold-50 text-gold-700",
                        )}
                      >
                        {grade.score ?? "—"}
                        {grade.maxScore ? `/${grade.maxScore}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  decimals = 0,
  suffix = "",
  tone = "navy",
}: {
  label: string;
  value: number | null;
  caption: string;
  decimals?: number;
  suffix?: string;
  tone?: "navy" | "gold";
}) {
  return (
    <div
      className="group relative h-full overflow-hidden rounded-2xl border border-border bg-background p-3.5 shadow-[0_1px_2px_rgba(11,26,51,0.04)] transition-colors hover:border-gold-300 sm:p-4"
      style={{ "--tone": tone === "gold" ? "var(--gold-500)" : "var(--navy-700)" } as CSSProperties}
    >
      <div
        aria-hidden
        className="tone-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <p className="relative text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:text-[11px] sm:tracking-[0.12em]">
        {label}
      </p>
      <p
        className={cn(
          "relative mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl",
          value === null ? "text-muted-foreground/60" : tone === "gold" ? "text-gold-700" : "text-navy-900",
        )}
      >
        {value === null ? (
          "—"
        ) : (
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        )}
      </p>
      <p className="relative mt-0.5 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="h-full rounded-2xl border border-border bg-background shadow-[0_1px_2px_rgba(11,26,51,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold text-navy-900">{title}</h2>
        {action}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-2 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
