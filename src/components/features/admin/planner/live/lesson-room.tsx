"use client";

/**
 * Sala de aula do planejador. Os três momentos da aula moram no mesmo
 * endereço, porque para quem dá aula é uma coisa só: antes (escolher o plano
 * e começar), durante (folha viva, chamada, tarefa) e depois (registro
 * fechado, com PDF).
 *
 * Durante a aula o conteúdo é uma CÓPIA do plano: o que se escreve aqui não
 * volta para o ateliê. É o que permite improvisar em cima do plano sem medo
 * de estragá-lo para a próxima turma.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { JSONContent } from "@tiptap/react";
import {
  endPlannerSessionAction,
  savePlannerSessionContentAction,
  savePlannerSessionVersionAction,
  acquirePlannerLockAction,
  startPlannerSessionAction,
} from "@/actions/admin/lesson-planner";
import { LessonCanvas } from "@/components/features/admin/planner/editor/lesson-canvas-dynamic";
import { AutosaveIndicator } from "@/components/features/live-session/autosave-indicator";
import { DownloadPdfButton } from "@/components/features/library/download-pdf-button";
import { useAutosave } from "@/hooks/use-autosave";
import { Select } from "@/components/ui/select";
import {
  ArrowLeftIcon,
  CloseIcon,
  EyeIcon,
  SpinnerIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { RosterPanel } from "./roster-panel";
import { STATUS_META, formatDay, formatTime, formatWeekday } from "../planner-utils";
import type { AttendanceRow } from "@/repositories/attendance";
import type { LiveSessionDetail } from "@/repositories/live-session";
import type { PlannerPlan, PlannerSession } from "@/repositories/lesson-planner";
import type { Json } from "@/types/database.types";

const VERSION_SNAPSHOT_MS = 5 * 60 * 1000;
const LOCK_HEARTBEAT_MS = 30_000;

export interface LessonRoomProps {
  session: PlannerSession;
  live: LiveSessionDetail;
  plans: PlannerPlan[];
  attendance: AttendanceRow[];
}

export function LessonRoom(props: LessonRoomProps) {
  if (props.session.status === "scheduled") return <BeforeLesson {...props} />;
  if (props.session.status === "completed") return <AfterLesson {...props} />;
  return <DuringLesson {...props} />;
}

function RoomHeader({
  session,
  right,
}: {
  session: PlannerSession;
  right?: React.ReactNode;
}) {
  const status = STATUS_META[session.status];
  return (
    <div className="sticky top-0 z-30 -mx-6 mb-6 border-b border-admin-border/70 bg-admin-background/85 px-6 py-3 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/planejador"
          aria-label="Voltar ao planejador"
          className="grid h-9 w-9 place-items-center rounded-lg border border-admin-border text-admin-foreground/60 transition-colors hover:bg-admin-muted hover:text-admin-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[10px] font-semibold",
                status.className,
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  status.dot,
                  session.status === "in_progress" && "live-dot relative",
                )}
                aria-hidden
              />
              {status.label}
            </span>
            <h1 className="truncate text-lg font-semibold text-admin-foreground">
              {session.title}
            </h1>
          </div>
          <p className="truncate text-xs text-admin-foreground/50">
            {session.groupName} · {session.teacherName} · {formatWeekday(session.scheduledAt)},{" "}
            {formatDay(session.scheduledAt)} às {formatTime(session.scheduledAt)}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
    </div>
  );
}

/** Antes: escolher de qual plano a aula parte e apertar o botão. */
function BeforeLesson({ session, plans, attendance }: LessonRoomProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [planId, setPlanId] = useState(session.lessonPlanId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startPlannerSessionAction(session.id, planId || null);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] pb-10">
      <RoomHeader session={session} />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <section className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="border-b border-admin-border/70 bg-gradient-to-r from-navy-50 to-transparent px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">
              Tudo pronto
            </p>
            <h2 className="mt-1 text-2xl font-bold text-admin-foreground">
              Começar a aula
            </h2>
            <p className="mt-1 text-sm text-admin-foreground/60">
              Ao iniciar, o conteúdo do plano é copiado para esta aula. Edite à vontade
              durante o encontro — o plano original fica intacto.
            </p>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="space-y-1.5">
              <label
                htmlFor="room-plan"
                className="text-sm font-medium text-admin-foreground"
              >
                Plano de aula
              </label>
              <Select id="room-plan" tone="admin" value={planId} onChange={setPlanId}>
                <option value="">Começar com folha em branco</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.level} · {plan.title}
                  </option>
                ))}
              </Select>
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={start}
              disabled={isPending}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--success)] px-5 text-sm font-semibold text-white shadow-[0_12px_30px_-16px_rgba(16,122,90,0.9)] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  Iniciando…
                </>
              ) : (
                "Iniciar aula agora"
              )}
            </button>
          </div>
        </section>

        <aside className="rounded-2xl border border-admin-border bg-admin-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/55">
            Turma ({attendance.length})
          </h2>
          <ul className="mt-3 space-y-1.5">
            {attendance.map((row) => (
              <li
                key={row.studentId}
                className="truncate rounded-lg border border-admin-border/70 px-3 py-2 text-xs text-admin-foreground/75"
              >
                {row.studentName}
              </li>
            ))}
            {attendance.length === 0 && (
              <li className="rounded-lg border border-dashed border-admin-border px-3 py-6 text-center text-xs text-admin-foreground/50">
                Nenhum aluno matriculado.
              </li>
            )}
          </ul>
        </aside>
      </motion.div>
    </div>
  );
}

interface SavePayload {
  content: JSONContent;
  teacherNotes: string;
  homework: string;
}

/** Durante: a folha manda na tela, o resto é apoio. */
function DuringLesson({ session, live, attendance }: LessonRoomProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [content, setContent] = useState<JSONContent>(
    (live.content as JSONContent) ?? { type: "doc", content: [] },
  );
  const [teacherNotes, setTeacherNotes] = useState(live.teacherNotes ?? "");
  const [homework, setHomework] = useState(live.homework ?? "");
  const [projecting, setProjecting] = useState(false);
  const [lockWarning, setLockWarning] = useState(false);
  const [ending, setEnding] = useState(false);

  const clientId = useRef<string>("");
  if (!clientId.current) clientId.current = crypto.randomUUID();

  const latest = useRef<SavePayload>({ content, teacherNotes, homework });
  latest.current = { content, teacherNotes, homework };

  const save = useCallback(
    async (value: SavePayload) => {
      const result = await savePlannerSessionContentAction(
        session.id,
        value.content as Json,
        value.teacherNotes,
        value.homework,
      );
      return result.success;
    },
    [session.id],
  );

  const { status, lastSavedAt, schedule, flush } = useAutosave<SavePayload>(save);

  // Trava leve: duas abas do mesmo admin sobrescreveriam uma à outra em
  // silêncio. O aviso é suficiente — ninguém fica bloqueado.
  useEffect(() => {
    void acquirePlannerLockAction(session.id, clientId.current).then((result) => {
      if (result.heldBySomeoneElse) setLockWarning(true);
    });
    const heartbeat = window.setInterval(() => {
      void acquirePlannerLockAction(session.id, clientId.current);
    }, LOCK_HEARTBEAT_MS);
    return () => window.clearInterval(heartbeat);
  }, [session.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void savePlannerSessionVersionAction(session.id, latest.current.content as Json);
    }, VERSION_SNAPSHOT_MS);
    return () => window.clearInterval(timer);
  }, [session.id]);

  useEffect(() => {
    if (!projecting) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setProjecting(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [projecting]);

  function update(patch: Partial<SavePayload>) {
    const next = { ...latest.current, ...patch };
    if (patch.content) setContent(patch.content);
    if (patch.teacherNotes !== undefined) setTeacherNotes(patch.teacherNotes);
    if (patch.homework !== undefined) setHomework(patch.homework);
    schedule(next);
  }

  async function end() {
    if (
      !window.confirm(
        "Encerrar a aula? O registro é publicado para os alunos e o PDF é gerado.",
      )
    )
      return;
    await flush();
    setEnding(true);
    const result = await endPlannerSessionAction(session.id);
    setEnding(false);
    if (result.success) router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] pb-10">
      <RoomHeader
        session={session}
        right={
          <>
            <span className="hidden sm:block">
              <AutosaveIndicator status={status} lastSavedAt={lastSavedAt} />
            </span>
            <LessonClock startedAt={live.startedAt} durationMinutes={live.durationMinutes} />
            <button
              type="button"
              onClick={() => setProjecting(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-admin-border px-3 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground"
            >
              <EyeIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Projetar</span>
            </button>
            <button
              type="button"
              onClick={end}
              disabled={ending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy-900 px-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {ending ? (
                <>
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  Encerrando…
                </>
              ) : (
                "Encerrar aula"
              )}
            </button>
          </>
        }
      />

      {lockWarning && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-gold-300 bg-gold-50 px-4 py-2.5 text-sm text-admin-foreground/80"
        >
          Esta aula está aberta em outra aba ou dispositivo. O que você escrever aqui pode
          ser sobrescrito.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          {/* A folha fica com a janela menos o cabeçalho e os cartões de
              tarefa/notas logo abaixo; o resto rola normalmente. */}
          <div className="lg:h-[calc(100dvh-24rem)]">
            <LessonCanvas
              content={content}
              onChange={(next) => update({ content: next })}
              scope={`aula-${session.id}`}
              placeholder="Escreva o que está acontecendo na aula… cole imagens com Ctrl+V."
              fill
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldCard
              id="room-homework"
              label="Tarefa de casa"
              hint="Visível para o aluno no registro da aula."
              value={homework}
              onChange={(value) => update({ homework: value })}
            />
            <FieldCard
              id="room-notes"
              label="Notas privadas"
              hint="Só você vê — não entra no PDF do aluno."
              value={teacherNotes}
              onChange={(value) => update({ teacherNotes: value })}
            />
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pb-2">
          <section className="rounded-2xl border border-admin-border bg-admin-surface p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/55">
              Chamada
            </h2>
            <RosterPanel sessionId={session.id} initialRows={attendance} />
          </section>
        </aside>
      </div>

      <AnimatePresence>
        {projecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            className="lesson-stage fixed inset-0 z-50 overflow-y-auto bg-white"
          >
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-admin-border bg-white/90 px-6 py-3 backdrop-blur">
              <span className="live-dot relative inline-block h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-admin-foreground">
                  {session.title} · {session.groupName}
                </p>
                <p className="text-[11px] text-admin-foreground/50">
                  Modo projeção · Esc para sair
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProjecting(false)}
                aria-label="Sair da projeção"
                className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-admin-border text-admin-foreground/60 transition-colors hover:bg-admin-muted"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-8">
              <LessonCanvas
                content={content}
                editable={false}
                presenting
                scope={`aula-${session.id}`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Depois: registro fechado — leitura, PDF e a chamada como ficou. */
function AfterLesson({ session, live, attendance }: LessonRoomProps) {
  return (
    <div className="mx-auto w-full max-w-[1800px] pb-10">
      <RoomHeader
        session={session}
        right={<DownloadPdfButton sessionId={session.id} hasPdf={!!live.pdfPath} />}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <div className="lg:h-[calc(100dvh-14rem)]">
            <LessonCanvas
              content={(live.content as JSONContent) ?? { type: "doc", content: [] }}
              editable={false}
              scope={`aula-${session.id}`}
              fill
            />
          </div>

          {live.homework && (
            <section className="rounded-2xl border border-admin-border bg-admin-surface p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/55">
                Tarefa de casa
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-admin-foreground/80">
                {live.homework}
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pb-2">
          <section className="rounded-2xl border border-admin-border bg-admin-surface p-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/55">
              Encerrada
            </h2>
            <p className="mb-3 text-xs text-admin-foreground/55">
              {live.endedAt
                ? new Date(live.endedAt).toLocaleString("pt-BR")
                : "sem registro de término"}
            </p>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/55">
              Chamada
            </h3>
            <RosterPanel sessionId={session.id} initialRows={attendance} readOnly />
          </section>
        </aside>
      </div>
    </div>
  );
}

function FieldCard({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-admin-border bg-admin-surface p-4">
      <label htmlFor={id} className="text-sm font-medium text-admin-foreground">
        {label}
      </label>
      <p className="mt-0.5 text-[11px] text-admin-foreground/50">{hint}</p>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-admin-border bg-admin-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
      />
    </div>
  );
}

/**
 * Relógio da aula: quanto já correu e quanto falta do tempo previsto. GSAP
 * anima o arco porque é um valor contínuo — refazer o React a cada segundo
 * só para mover um traço seria desperdício.
 */
function LessonClock({
  startedAt,
  durationMinutes,
}: {
  startedAt: string | null;
  durationMinutes: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  const arcRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!startedAt) return;
    const started = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - started) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const total = durationMinutes * 60;
  const ratio = total > 0 ? Math.min(elapsed / total, 1) : 0;

  useEffect(() => {
    const arc = arcRef.current;
    if (!arc) return;
    const circumference = 2 * Math.PI * 13;
    gsap.to(arc, {
      strokeDashoffset: circumference * (1 - ratio),
      duration: 0.6,
      ease: "power2.out",
      overwrite: true,
    });
  }, [ratio]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const over = ratio >= 1;

  return (
    <span
      title={`Tempo de aula (previsto: ${durationMinutes} min)`}
      className={cn(
        "hidden items-center gap-2 rounded-full border px-2.5 py-1 sm:inline-flex",
        over
          ? "border-gold-300 bg-gold-50 text-gold-700"
          : "border-admin-border text-admin-foreground/70",
      )}
    >
      <svg viewBox="0 0 30 30" className="h-6 w-6 -rotate-90" aria-hidden>
        <circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
        <circle
          ref={arcRef}
          cx="15"
          cy="15"
          r="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 13}
          strokeDashoffset={2 * Math.PI * 13}
        />
      </svg>
      <span className="text-xs font-semibold tabular">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </span>
  );
}
