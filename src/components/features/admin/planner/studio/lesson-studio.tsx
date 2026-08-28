"use client";

/**
 * Ateliê da aula: a folha ocupa a tela, o resto é contexto. A barra do topo
 * gruda enquanto se rola o documento porque é onde vivem o estado do
 * salvamento e o botão de agendar — as duas informações que o professor
 * procura sem parar de escrever.
 *
 * O conteúdo salva sozinho (`useAutosave`, o mesmo da sala ao vivo): 2 s de
 * pausa ou 15 s de digitação contínua, com retentativa em backoff. Perder
 * material de aula é o pior desfecho possível desta tela.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { JSONContent } from "@tiptap/react";
import { savePlannerPlanContentAction } from "@/actions/admin/lesson-planner";
import { LessonCanvas } from "@/components/features/admin/planner/editor/lesson-canvas-dynamic";
import { AutosaveIndicator } from "@/components/features/live-session/autosave-indicator";
import { useAutosave } from "@/hooks/use-autosave";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CloseIcon,
  EyeIcon,
  PencilIcon,
} from "@/components/ui/icons";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import { useArea } from "@/components/features/admin/area-context";
import { PlanFormPanel } from "../plan-form-panel";
import { SchedulePanel } from "../schedule-panel";
import { LEVEL_HINT, STATUS_META, formatDay, formatTime } from "../planner-utils";
import type {
  PlannerGroupOption,
  PlannerPlan,
  PlannerPlanDetail,
  PlannerSession,
} from "@/repositories/lesson-planner";
import type { UserListItem } from "@/repositories/users";
import type { Json } from "@/types/database.types";

export interface LessonStudioProps {
  plan: PlannerPlanDetail;
  sessions: PlannerSession[];
  groups: PlannerGroupOption[];
  teachers: UserListItem[];
  /**
   * Plano compartilhado de outra pessoa: dá para ler, apresentar e agendar,
   * mas não reescrever — o autosave nem é ligado (a action recusaria de
   * qualquer forma, e um "salvando…" que nunca salva é pior que nada).
   */
  readOnly?: boolean;
}

export function LessonStudio({
  plan,
  sessions,
  groups,
  teachers,
  readOnly = false,
}: LessonStudioProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { base } = useArea();

  const [content, setContent] = useState<JSONContent>(
    (plan.content as JSONContent) ?? { type: "doc", content: [] },
  );
  const [presenting, setPresenting] = useState(false);
  /**
   * Régua dentro da apresentação. Começa escondida — a tela está projetada
   * para a turma —, mas a aula continua editável: o professor escreve por cima
   * do que preparou e, quando precisa de cor, tabela ou imagem, chama a régua.
   */
  const [presentToolbar, setPresentToolbar] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [, startTransition] = useTransition();

  const shellRef = useRef<HTMLDivElement>(null);

  const save = useCallback(
    async (value: JSONContent) => {
      const result = await savePlannerPlanContentAction(plan.id, value as Json);
      return result.success;
    },
    [plan.id],
  );

  const { status, lastSavedAt, schedule, flush } = useAutosave<JSONContent>(save);

  /**
   * Entrada da tela. `from()` começa escrevendo o estado inicial (opacity 0)
   * no elemento — então a limpeza TEM que ser `revert()`, e não `kill()`:
   * matar o tween sem reverter congela a folha invisível, que era o que
   * deixava a tela em branco até um F5 (o efeito monta e desmonta duas vezes
   * em desenvolvimento). `clearProps` remove os estilos ao terminar, para o
   * documento não ficar com transform residual.
   */
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const targets = shell.querySelectorAll<HTMLElement>("[data-studio-enter]");
    if (targets.length === 0) return;

    if (reduceMotion) {
      gsap.set(targets, { clearProps: "opacity,transform" });
      return;
    }

    const tween = gsap.from(targets, {
      y: 18,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
      stagger: 0.07,
      clearProps: "opacity,transform",
    });

    return () => {
      tween.revert();
    };
  }, [reduceMotion]);

  /**
   * Fechar a apresentação salva na hora: o que foi escrito com a turma na
   * frente não pode ficar pendurado no temporizador do autosave enquanto o
   * professor já fechou o notebook.
   */
  const closePresenting = useCallback(() => {
    setPresenting(false);
    setPresentToolbar(false);
    if (!readOnly) void flush();
  }, [flush, readOnly]);

  // Sair da apresentação com Escape — o professor está com a tela projetada,
  // não com a mão no mouse.
  useEffect(() => {
    if (!presenting) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePresenting();
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [presenting, closePresenting]);

  function handleChange(next: JSONContent) {
    setContent(next);
    schedule(next);
  }

  return (
    <div ref={shellRef} className="mx-auto w-full max-w-[1800px] pb-10">
      <div
        data-studio-enter
        className="sticky top-0 z-30 -mx-4 mb-6 border-b border-admin-border/70 bg-admin-background/85 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`${base}/planejador` as Route}
            className="grid h-9 w-9 place-items-center rounded-lg border border-admin-border text-admin-foreground/60 transition-colors hover:bg-admin-muted hover:text-admin-foreground"
            aria-label="Voltar ao planejador"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded-full border border-gold-300 bg-gold-50 px-2 text-[10px] font-bold text-gold-700">
                {plan.level}
              </span>
              <h1 className="truncate text-lg font-semibold text-admin-foreground">
                {plan.title}
              </h1>
            </div>
            <p className="truncate text-xs text-admin-foreground/50">
              {LEVEL_HINT[plan.level]} · {plan.durationMinutes} min · {plan.authorName}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!readOnly && (
              <span className="hidden sm:block">
                <AutosaveIndicator status={status} lastSavedAt={lastSavedAt} />
              </span>
            )}

            {!readOnly && (
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-admin-border px-3 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground"
              >
                <PencilIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Ficha</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                void flush();
                setPresenting(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-admin-border px-3 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground"
            >
              <EyeIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Apresentar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  await flush();
                  setScheduleOpen(true);
                });
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-gold-600 to-gold-400 px-3.5 text-sm font-semibold text-admin-foreground shadow-[0_8px_24px_-14px_rgba(201,162,39,0.8)] transition-opacity hover:opacity-95"
            >
              <CalendarIcon className="h-4 w-4" />
              Agendar
            </button>
          </div>
        </div>
      </div>

      {/*
        A folha manda na largura: a coluna de apoio tem tamanho fixo por
        faixa de tela e todo o resto sobra para o canvas. Abaixo de `lg` as
        duas viram uma coluna só — o painel de dicas e agendamentos desce
        para depois do documento, que é a ordem de leitura no celular.
      */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* A altura vem daqui: a folha é o que sobra da janela depois da
            barra do painel, do cabeçalho e do respiro de baixo. */}
        <div data-studio-enter className="min-w-0 lg:h-[calc(100dvh-13.5rem)]">
          <LessonCanvas
            content={content}
            onChange={readOnly ? undefined : handleChange}
            editable={!readOnly}
            scope={`plano-${plan.id}`}
            placeholder="Comece pelo objetivo da aula… cole imagens direto aqui (Ctrl+V)."
            fill
          />
        </div>

        <aside
          data-studio-enter
          className="space-y-4 lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pb-2"
        >
          <section className="rounded-2xl border border-admin-border bg-admin-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/55">
              Como montar
            </h2>
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-admin-foreground/65">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                <span>
                  <strong className="font-medium text-admin-foreground">
                    Cole a imagem
                  </strong>{" "}
                  com Ctrl+V ou arraste o arquivo para a folha — ela entra na hora e sobe
                  para o servidor sozinha.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                <span>
                  <strong className="font-medium text-admin-foreground">
                    Arraste a imagem
                  </strong>{" "}
                  para movê-la pela folha, para os lados ou para cima e para baixo; os
                  cantos redimensionam e a barrinha acima dela alinha, devolve ao lugar ou
                  remove.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                <span>
                  Selecione um trecho para abrir o menu rápido de negrito, itálico e
                  realce.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                <span>
                  Tudo é salvo automaticamente — <em>Apresentar</em> mostra a aula em tela
                  cheia, do jeito que o aluno vê, e continua editável: escreva por cima e
                  chame a régua em <em>Ferramentas</em>.
                </span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-admin-border bg-admin-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/55">
                Agendamentos
              </h2>
              <span className="text-xs tabular text-admin-foreground/45">
                {sessions.length}
              </span>
            </div>

            {sessions.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-admin-foreground/55">
                Esta aula ainda não foi agendada. Use <strong>Agendar</strong> para
                escolher a turma e o horário.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sessions.map((session) => {
                  const status = STATUS_META[session.status];
                  return (
                    <li key={session.id}>
                      <Link
                        href={`${base}/planejador/aula/${session.id}` as Route}
                        className="flex items-center gap-3 rounded-xl border border-admin-border/70 px-3 py-2 transition-colors hover:border-navy-100 hover:bg-admin-muted/50"
                      >
                        <span className="flex w-14 shrink-0 flex-col">
                          <span className="text-xs font-semibold tabular text-admin-foreground">
                            {formatTime(session.scheduledAt)}
                          </span>
                          <span className="text-[10px] text-admin-foreground/45">
                            {formatDay(session.scheduledAt)}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-admin-foreground">
                            {session.groupName}
                          </span>
                          <span className="block truncate text-[10px] text-admin-foreground/50">
                            {session.teacherName}
                          </span>
                        </span>
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dot)}
                          title={status.label}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <AnimatePresence>
        {presenting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            className="lesson-stage fixed inset-0 z-50 overflow-y-auto bg-white"
          >
            {/* Acima da régua da folha (z-20), que gruda logo abaixo desta barra. */}
            <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-admin-border bg-white/90 px-6 py-3 backdrop-blur">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-admin-foreground">
                  {plan.title}
                </p>
                <p className="text-[11px] text-admin-foreground/50">
                  {readOnly
                    ? "Modo apresentação · Esc para sair"
                    : "Modo apresentação · dá para escrever na folha · Esc para sair"}
                </p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {!readOnly && (
                  <>
                    <span className="hidden sm:block">
                      <AutosaveIndicator status={status} lastSavedAt={lastSavedAt} />
                    </span>
                    <button
                      type="button"
                      onClick={() => setPresentToolbar((open) => !open)}
                      aria-pressed={presentToolbar}
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                        presentToolbar
                          ? "border-navy-900 bg-navy-900 text-white"
                          : "border-admin-border text-admin-foreground/70 hover:bg-admin-muted hover:text-admin-foreground",
                      )}
                    >
                      <PencilIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Ferramentas</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={closePresenting}
                  aria-label="Sair da apresentação"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-admin-border text-admin-foreground/60 transition-colors hover:bg-admin-muted"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <motion.div
              initial={reduceMotion ? false : { y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-8"
            >
              <LessonCanvas
                content={content}
                onChange={readOnly ? undefined : handleChange}
                editable={!readOnly}
                presenting
                showToolbar={presentToolbar}
                scope={`plano-${plan.id}`}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PlanFormPanel
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          router.refresh();
        }}
        plan={plan as PlannerPlan}
      />

      <SchedulePanel
        open={scheduleOpen}
        onClose={() => {
          setScheduleOpen(false);
          router.refresh();
        }}
        groups={groups}
        plans={[plan as PlannerPlan]}
        teachers={teachers}
        defaultPlanId={plan.id}
      />
    </div>
  );
}
