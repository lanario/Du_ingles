"use client";

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

const TZ = "America/Sao_Paulo";

export interface TeacherSession {
  id: string;
  title: string;
  groupName: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
}

export interface TeacherGroup {
  id: string;
  name: string;
  level: string;
  enrolledCount: number;
  maxStudents: number;
}

export interface TeacherPlan {
  id: string;
  title: string;
  level: string | null;
  updatedAt: string;
}

export interface TeacherDashboardData {
  firstName: string;
  sessions: TeacherSession[];
  groups: TeacherGroup[];
  plans: TeacherPlan[];
  totalStudents: number;
  sessionsNext7Days: number;
}

function formatDate(iso: string, pattern: string) {
  return formatInTimeZone(new Date(iso), TZ, pattern, { locale: ptBR });
}

/** Painel do professor: agenda em primeiro plano, turmas e planos logo abaixo. */
export function TeacherDashboard({ data }: { data: TeacherDashboardData }) {
  const reduced = useReducedMotion();
  const nextSession = data.sessions[0];

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal y={16}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">
              Área do professor
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy-900">
              Olá, {data.firstName} 👋
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {nextSession
                ? `Próxima aula ${formatDate(nextSession.scheduledAt, "EEEE',' dd/MM 'às' HH:mm")} — ${nextSession.groupName}.`
                : "Nenhuma aula agendada na sua agenda."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/planos-de-aula/novo"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3.5 text-sm font-medium transition-colors hover:border-gold-400 hover:bg-gold-50"
            >
              Novo plano de aula
            </Link>
            {nextSession && (
              <Link
                href={`/aula/${nextSession.id}`}
                className="inline-flex h-9 items-center rounded-lg bg-navy-900 px-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Abrir próxima aula
              </Link>
            )}
          </div>
        </div>
      </Reveal>

      <RevealGrid className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RevealItem>
          <StatCard
            label="Turmas"
            value={data.groups.length}
            caption="sob sua responsabilidade"
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Alunos"
            value={data.totalStudents}
            caption="matriculados nas suas turmas"
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Aulas em 7 dias"
            value={data.sessionsNext7Days}
            caption="na sua agenda"
            tone="gold"
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Planos de aula"
            value={data.plans.length}
            caption="seus e compartilhados"
          />
        </RevealItem>
      </RevealGrid>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Panel
            title="Agenda"
            action={
              <span className="text-xs text-muted-foreground">
                {data.sessions.length} próxima(s)
              </span>
            }
          >
            {data.sessions.length === 0 ? (
              <Empty>
                Nenhuma aula agendada. Crie uma turma no painel admin para começar.
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {data.sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/aula/${session.id}`}
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
                      {session.status === "in_progress" && (
                        <span className="flex-none rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-700">
                          em andamento
                        </span>
                      )}
                      <span className="tabular flex-none text-sm font-medium text-navy-800">
                        {formatDate(session.scheduledAt, "HH:mm")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={0.06}>
          <Panel title="Minhas turmas">
            {data.groups.length === 0 ? (
              <Empty>Nenhuma turma atribuída.</Empty>
            ) : (
              <ul className="space-y-3 px-3 py-2">
                {data.groups.map((group) => {
                  const rate =
                    group.maxStudents > 0
                      ? (100 * group.enrolledCount) / group.maxStudents
                      : 0;
                  return (
                    <li key={group.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm text-foreground/85">
                          {group.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {group.level}
                          </span>
                        </span>
                        <span className="tabular flex-none text-sm font-semibold text-navy-900">
                          {group.enrolledCount}/{group.maxStudents}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className={cn(
                            "h-full rounded-full",
                            rate >= 90
                              ? "bg-gradient-to-r from-gold-600 to-gold-400"
                              : "bg-gradient-to-r from-navy-800 to-navy-500",
                          )}
                          initial={reduced ? false : { width: 0 }}
                          whileInView={{ width: `${Math.min(100, rate)}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </Reveal>
      </div>

      <Reveal className="mt-4">
        <Panel
          title="Planos de aula recentes"
          action={
            <Link
              href="/planos-de-aula"
              className="text-xs font-medium text-navy-700 underline-offset-4 hover:underline"
            >
              Ver todos
            </Link>
          }
        >
          {data.plans.length === 0 ? (
            <Empty>Nenhum plano de aula ainda.</Empty>
          ) : (
            <ul className="grid gap-2 p-1 sm:grid-cols-2 lg:grid-cols-3">
              {data.plans.map((plan) => (
                <li key={plan.id}>
                  <Link
                    href={`/planos-de-aula/${plan.id}`}
                    className="block h-full rounded-xl border border-border p-3.5 transition-colors hover:border-gold-300 hover:bg-muted/50"
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {plan.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.level ? `${plan.level} · ` : ""}
                      atualizado em {formatDate(plan.updatedAt, "dd/MM/yyyy")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  tone = "navy",
}: {
  label: string;
  value: number;
  caption: string;
  tone?: "navy" | "gold";
}) {
  return (
    <div className="h-full rounded-2xl border border-border bg-background p-4 shadow-[0_1px_2px_rgba(11,26,51,0.04)] transition-colors hover:border-gold-300">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tracking-tight",
          tone === "gold" ? "text-gold-700" : "text-navy-900",
        )}
      >
        <CountUp value={value} />
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
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
