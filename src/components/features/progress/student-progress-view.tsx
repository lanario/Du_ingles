"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
import { RadialGauge, PALETTE, smoothPath, prefersReducedMotion } from "@/components/features/admin/dashboard/charts";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  DueDateIcon,
  GraduationIcon,
  GroupsIcon,
  TaskIcon,
  TrendUpIcon,
  WalletIcon,
} from "@/components/ui/icons";
import type { GradedAssignmentRow, GroupProgress, NextSessionInfo } from "@/repositories/progress";
import type { CefrLevel } from "@/types/domain";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const TZ = "America/Sao_Paulo";
const CEFR_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const CEFR_DESCRIPTIONS: Record<CefrLevel, string> = {
  A1: "Iniciante",
  A2: "Básico",
  B1: "Intermediário",
  B2: "Intermediário superior",
  C1: "Avançado",
  C2: "Proficiente",
};

function formatDate(iso: string, pattern: string) {
  return formatInTimeZone(new Date(iso), TZ, pattern, { locale: ptBR });
}

export interface PendingTaskRow {
  id: string;
  title: string;
  groupName: string;
  dueAt: string | null;
  status: string;
}

export interface SubscriptionInfo {
  planName: string | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

export interface StudentProgressViewProps {
  firstName: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  currentLevel: CefrLevel | null;
  enrollmentDate: string | null;
  goals: string | null;
  completedSessions: number;
  overallAttendanceRate: number | null;
  streak: number;
  groups: GroupProgress[];
  grades: GradedAssignmentRow[];
  averageScore: number | null;
  nextSession: NextSessionInfo | null;
  pendingTasks: PendingTaskRow[];
  subscription: SubscriptionInfo | null;
}

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : "";
  return `${first}${last}`.toUpperCase();
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-16 w-16 flex-none rounded-2xl border-2 border-white object-cover shadow-[0_10px_30px_-14px_rgba(10,31,68,0.6)]"
      />
    );
  }
  return (
    <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl border-2 border-white bg-gradient-to-br from-navy-800 to-navy-600 text-xl font-semibold text-gold-300 shadow-[0_10px_30px_-14px_rgba(10,31,68,0.6)]">
      {initialsOf(name)}
    </div>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || streak < 3 || prefersReducedMotion()) return;
    const tween = gsap.to(el, {
      scale: 1.12,
      duration: 0.85,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });
    return () => {
      tween.kill();
    };
  }, [streak]);

  if (streak < 2) return null;

  return (
    <span
      ref={ref}
      className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-700"
    >
      🔥 {streak} aulas seguidas
    </span>
  );
}

function ProgressHeader({
  firstName,
  fullName,
  email,
  avatarUrl,
  currentLevel,
  enrollmentDate,
  streak,
}: Pick<
  StudentProgressViewProps,
  "firstName" | "fullName" | "email" | "avatarUrl" | "currentLevel" | "enrollmentDate" | "streak"
>) {
  const memberSince = enrollmentDate
    ? formatDate(enrollmentDate, "MMMM 'de' yyyy")
    : null;

  return (
    <Reveal>
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={fullName} avatarUrl={avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">
            Área do aluno
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-navy-900 sm:text-3xl">
            {fullName || firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {email}
            {memberSince && <span className="capitalize"> · aluno desde {memberSince}</span>}
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          <StreakBadge streak={streak} />
          {currentLevel && (
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-300 bg-gold-50 px-3.5 py-1.5 text-sm font-medium text-gold-700">
              Nível atual
              <span className="rounded-full bg-navy-900 px-2 py-0.5 text-xs font-semibold text-gold-300">
                {currentLevel}
              </span>
            </span>
          )}
        </div>
      </div>
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// Escada CEFR
// ---------------------------------------------------------------------------

function LevelLadder({ currentLevel }: { currentLevel: CefrLevel | null }) {
  const reduced = useReducedMotion();
  const currentIndex = currentLevel ? CEFR_ORDER.indexOf(currentLevel) : -1;

  return (
    <Reveal delay={0.05}>
      <section className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Trilha de níveis (CEFR)
          </h2>
          {currentLevel && (
            <span className="text-xs text-muted-foreground">
              {CEFR_DESCRIPTIONS[currentLevel]}
            </span>
          )}
        </div>

        <div className="mt-5 flex items-center">
          {CEFR_ORDER.map((level, index) => {
            const done = currentIndex !== -1 && index < currentIndex;
            const isCurrent = index === currentIndex;
            const isLast = index === CEFR_ORDER.length - 1;

            return (
              <div key={level} className="flex flex-1 items-center last:flex-none">
                <motion.div
                  initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
                  className="relative flex flex-col items-center gap-1.5"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                      isCurrent
                        ? "border-gold-500 bg-navy-900 text-gold-300 shadow-[0_0_0_4px_rgba(201,162,39,0.18)]"
                        : done
                          ? "border-navy-700 bg-navy-700 text-white"
                          : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <CheckIcon className="h-4 w-4" /> : level}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      isCurrent ? "text-navy-900" : "text-muted-foreground",
                    )}
                  >
                    {level}
                  </span>
                </motion.div>
                {!isLast && (
                  <div className="mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-navy-100 sm:mx-2">
                    <motion.div
                      initial={reduced ? false : { scaleX: 0 }}
                      animate={{ scaleX: done ? 1 : 0 }}
                      style={{ transformOrigin: "left" }}
                      transition={{ duration: 0.4, delay: index * 0.07 + 0.15 }}
                      className="h-full w-full bg-navy-700"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function KpiCard({
  icon,
  label,
  value,
  decimals = 0,
  suffix = "",
  caption,
  tone = "navy",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  decimals?: number;
  suffix?: string;
  caption: string;
  tone?: "navy" | "gold";
}) {
  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-card)] transition-colors hover:border-gold-300">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            tone === "gold" ? "bg-gold-50 text-gold-700" : "bg-navy-50 text-navy-700",
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight sm:text-3xl",
          value === null ? "text-muted-foreground/60" : tone === "gold" ? "text-gold-700" : "text-navy-900",
        )}
      >
        {value === null ? "—" : <CountUp value={value} decimals={decimals} suffix={suffix} />}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Próxima aula
// ---------------------------------------------------------------------------

function NextSessionCard({ session }: { session: NextSessionInfo | null }) {
  const reduced = useReducedMotion();
  const now = Date.now();
  const start = session ? new Date(session.scheduledAt).getTime() : null;
  const end = start !== null && session ? start + session.durationMinutes * 60_000 : null;
  const isLive = start !== null && end !== null && now >= start && now <= end;

  return (
    <Reveal delay={0.08}>
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
          <div className="min-w-0">
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
            {session ? (
              <>
                <p className="mt-2 truncate text-xl font-semibold">{session.title}</p>
                <p className="mt-1 text-sm text-white/65">
                  {session.groupName} · prof. {session.teacherName} · {session.durationMinutes} min
                </p>
              </>
            ) : (
              <p className="mt-2 text-lg text-white/70">Nenhuma aula agendada por enquanto.</p>
            )}
          </div>

          {session && (
            <div className="text-right">
              <p className="tabular text-4xl font-semibold tracking-tight">
                {formatDate(session.scheduledAt, "HH:mm")}
              </p>
              <p className="mt-1 text-sm capitalize text-gold-300">
                {formatDate(session.scheduledAt, "EEEE',' dd 'de' MMMM")}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// Frequência por turma
// ---------------------------------------------------------------------------

function AttendanceRow({ group, index }: { group: GroupProgress; index: number }) {
  const reduceMotion = useReducedMotion();
  const low = group.attendanceRate < 75;

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className="space-y-2 px-4 py-3.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <span className="truncate font-medium text-navy-900">{group.groupName}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {group.level ? `${group.level} · ` : ""}
            prof. {group.teacherName}
          </span>
        </div>
        <span className={cn("tabular font-medium", low ? "text-warning" : "text-navy-700")}>
          {group.attendanceRate.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-navy-100">
        <motion.div
          initial={reduceMotion ? false : { scaleX: 0 }}
          whileInView={{ scaleX: Math.min(group.attendanceRate / 100, 1) }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.1 }}
          style={{ transformOrigin: "left" }}
          className={cn("h-full w-full rounded-full", low ? "bg-warning" : "bg-navy-600")}
        />
      </div>
      {group.nextSessionAt && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClockIcon className="h-3.5 w-3.5" />
          próxima aula {formatDate(group.nextSessionAt, "dd/MM 'às' HH:mm")}
        </p>
      )}
    </motion.li>
  );
}

// ---------------------------------------------------------------------------
// Notas — lista + tendência
// ---------------------------------------------------------------------------

function GradeTrend({ grades }: { grades: GradedAssignmentRow[] }) {
  const pathRef = useRef<SVGPathElement>(null);
  const width = 280;
  const height = 64;
  const pad = 8;

  const points = useMemo(() => {
    const scored = grades
      .filter((g) => g.score !== null && g.maxScore)
      .slice()
      .reverse() // da mais antiga para a mais recente
      .map((g) => (100 * g.score!) / g.maxScore!);
    if (scored.length === 0) return [];
    const stepX = scored.length > 1 ? (width - pad * 2) / (scored.length - 1) : 0;
    return scored.map((v, i) => ({
      x: pad + i * stepX,
      y: pad + (1 - v / 100) * (height - pad * 2),
      value: v,
    }));
  }, [grades]);

  const d = useMemo(() => smoothPath(points), [points]);

  useEffect(() => {
    const el = pathRef.current;
    if (!el || prefersReducedMotion()) return;
    const length = el.getTotalLength();
    const tween = gsap.fromTo(
      el,
      { strokeDasharray: length, strokeDashoffset: length },
      { strokeDashoffset: 0, duration: 1.1, ease: "power2.out" },
    );
    return () => {
      tween.kill();
    };
  }, [d]);

  if (points.length < 2) return null;

  return (
    <div className="border-t border-border px-4 py-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full" preserveAspectRatio="none">
        <path ref={pathRef} d={d} fill="none" stroke={PALETTE.gold} strokeWidth={2.5} strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={PALETTE.navy} />
        ))}
      </svg>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">
        Evolução das últimas {points.length} notas corrigidas
      </p>
    </div>
  );
}

function GradeRow({ grade, index }: { grade: GradedAssignmentRow; index: number }) {
  const reduceMotion = useReducedMotion();
  const percent =
    grade.score != null && grade.maxScore ? (100 * grade.score) / grade.maxScore : null;
  const tone =
    percent == null
      ? "text-navy-700"
      : percent >= 70
        ? "text-success"
        : percent >= 50
          ? "text-warning"
          : "text-destructive";

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className="flex items-center justify-between gap-3 px-4 py-3"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy-900">{grade.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {grade.groupName}
          {grade.gradedAt && ` · corrigida em ${formatDate(grade.gradedAt, "dd/MM/yyyy")}`}
        </p>
      </div>
      <span className={cn("tabular flex-none text-sm font-semibold", tone)}>
        {grade.score ?? "—"}
        {grade.maxScore ? ` / ${grade.maxScore}` : ""}
      </span>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------
// Tarefas pendentes
// ---------------------------------------------------------------------------

function PendingTaskRowView({ task, index }: { task: PendingTaskRow; index: number }) {
  const reduceMotion = useReducedMotion();
  const late = task.status === "late";

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
    >
      <Link
        href={`/tarefas/${task.id}`}
        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/70"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-navy-900">{task.title}</p>
          <p className="truncate text-xs text-muted-foreground">{task.groupName}</p>
        </div>
        <span
          className={cn(
            "flex-none rounded-full px-2.5 py-1 text-xs font-medium",
            late ? "bg-red-50 text-destructive" : "bg-gold-50 text-gold-700",
          )}
        >
          {task.dueAt ? formatDate(task.dueAt, "dd/MM 'às' HH:mm") : late ? "Atrasada" : "Sem prazo"}
        </span>
      </Link>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------
// Assinatura / plano
// ---------------------------------------------------------------------------

const SUBSCRIPTION_STATUS_TEXT: Record<string, { label: string; tone: string }> = {
  active: { label: "Ativa", tone: "var(--success)" },
  trialing: { label: "Em período de teste", tone: "var(--navy-500)" },
  past_due: { label: "Pagamento em atraso", tone: "var(--destructive)" },
  unpaid: { label: "Fatura em aberto", tone: "var(--destructive)" },
  paused: { label: "Pausada", tone: "var(--warning)" },
  canceled: { label: "Cancelada", tone: "var(--muted-foreground)" },
  incomplete: { label: "Pagamento pendente", tone: "var(--warning)" },
  incomplete_expired: { label: "Expirada", tone: "var(--muted-foreground)" },
};

function SubscriptionCard({ subscription }: { subscription: SubscriptionInfo | null }) {
  if (!subscription) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-muted/40 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Meu plano
        </h2>
        <p className="text-sm text-muted-foreground">
          Você ainda não tem um plano contratado.{" "}
          <Link href="/planos" className="font-medium text-navy-700 underline-offset-4 hover:underline">
            Ver planos
          </Link>
        </p>
      </section>
    );
  }

  const status = SUBSCRIPTION_STATUS_TEXT[subscription.status] ?? {
    label: subscription.status,
    tone: "var(--muted-foreground)",
  };
  const renews = subscription.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd, "dd/MM/yyyy")
    : null;

  return (
    <section className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <WalletIcon className="h-4 w-4" />
        Meu plano
      </h2>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          style={{
            color: status.tone,
            backgroundColor: `color-mix(in srgb, ${status.tone} 12%, #ffffff)`,
          }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        >
          <CheckIcon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy-900">
            {subscription.planName ?? "Plano contratado"} ·{" "}
            <span style={{ color: status.tone }}>{status.label}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subscription.cancelAtPeriodEnd
              ? renews
                ? `acesso até ${renews}`
                : "cancelamento agendado"
              : renews
                ? `próxima cobrança em ${renews}`
                : "sem data de renovação"}
          </p>
        </div>
      </div>
      <Link
        href="/planos"
        className="mt-4 inline-block text-xs font-medium text-navy-700 underline-offset-4 hover:underline"
      >
        Gerenciar plano
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Objetivos
// ---------------------------------------------------------------------------

function GoalsCard({ goals }: { goals: string | null }) {
  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-navy-50 to-white p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <GraduationIcon className="h-4 w-4" />
        Meus objetivos
      </h2>
      {goals ? (
        <p className="text-sm leading-relaxed text-navy-800">{goals}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum objetivo registrado ainda. Converse com seu professor sobre suas metas de
          aprendizado.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

function SectionHeading({
  icon,
  children,
  hint,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3.5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {children}
      </h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function StudentProgressView({
  firstName,
  fullName,
  email,
  avatarUrl,
  currentLevel,
  enrollmentDate,
  goals,
  completedSessions,
  overallAttendanceRate,
  streak,
  groups,
  grades,
  averageScore,
  nextSession,
  pendingTasks,
  subscription,
}: StudentProgressViewProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ProgressHeader
        firstName={firstName}
        fullName={fullName}
        email={email}
        avatarUrl={avatarUrl}
        currentLevel={currentLevel}
        enrollmentDate={enrollmentDate}
        streak={streak}
      />

      <NextSessionCard session={nextSession} />

      <RevealGrid className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <RevealItem>
          <KpiCard
            icon={<GroupsIcon className="h-4 w-4" />}
            label="Aulas concluídas"
            value={completedSessions}
            caption="com presença registrada"
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            icon={<CalendarIcon className="h-4 w-4" />}
            label="Frequência geral"
            value={overallAttendanceRate}
            decimals={0}
            suffix="%"
            caption={overallAttendanceRate === null ? "sem aulas concluídas" : "nas suas turmas"}
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            icon={<TrendUpIcon className="h-4 w-4" />}
            label="Nota média"
            value={averageScore}
            decimals={1}
            suffix="%"
            caption={averageScore === null ? "sem correções ainda" : "das tarefas corrigidas"}
            tone="gold"
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            icon={<TaskIcon className="h-4 w-4" />}
            label="Tarefas pendentes"
            value={pendingTasks.length}
            caption="aguardando sua entrega"
            tone={pendingTasks.length > 0 ? "gold" : "navy"}
          />
        </RevealItem>
      </RevealGrid>

      <LevelLadder currentLevel={currentLevel} />

      <div className="grid gap-4 md:grid-cols-3">
        <Reveal className="md:col-span-2">
          <section className="h-full rounded-2xl border border-border bg-background shadow-[var(--shadow-card)]">
            <SectionHeading icon={<GroupsIcon className="h-4 w-4" />}>
              Frequência por turma
            </SectionHeading>
            {groups.length === 0 ? (
              <p className="mx-4 mt-4 mb-4 rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-muted-foreground">
                Nenhuma matrícula ativa.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {groups.map((group, index) => (
                  <AttendanceRow key={group.groupId} group={group} index={index} />
                ))}
              </ul>
            )}
          </section>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)]">
            <RadialGauge
              value={overallAttendanceRate ?? 0}
              label="Frequência"
              color={PALETTE.gold}
              size={150}
              caption="média geral nas suas turmas"
            />
          </div>
        </Reveal>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Reveal>
          <section className="h-full rounded-2xl border border-border bg-background shadow-[var(--shadow-card)]">
            <SectionHeading icon={<TaskIcon className="h-4 w-4" />} hint={`${grades.length} corrigidas`}>
              Notas de tarefas
            </SectionHeading>
            {grades.length === 0 ? (
              <p className="mx-4 mt-4 mb-4 rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-muted-foreground">
                Nenhuma tarefa corrigida ainda.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {grades.slice(0, 6).map((grade, index) => (
                    <GradeRow key={`${grade.title}-${grade.groupName}-${index}`} grade={grade} index={index} />
                  ))}
                </ul>
                <GradeTrend grades={grades} />
              </>
            )}
          </section>
        </Reveal>

        <Reveal delay={0.06}>
          <section className="h-full rounded-2xl border border-border bg-background shadow-[var(--shadow-card)]">
            <SectionHeading icon={<DueDateIcon className="h-4 w-4" />}>
              Tarefas pendentes
            </SectionHeading>
            {pendingTasks.length === 0 ? (
              <p className="mx-4 mt-4 mb-4 rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-muted-foreground">
                Nenhuma tarefa pendente. 🎉
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingTasks.slice(0, 6).map((task, index) => (
                  <PendingTaskRowView key={task.id} task={task} index={index} />
                ))}
              </ul>
            )}
          </section>
        </Reveal>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Reveal>
          <SubscriptionCard subscription={subscription} />
        </Reveal>
        <Reveal delay={0.06}>
          <GoalsCard goals={goals} />
        </Reveal>
      </div>
    </div>
  );
}
