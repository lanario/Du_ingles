"use client";

/**
 * Ficha da turma em modal — o que abre no "Abrir turma" e no nome da turma.
 *
 * Antes isso era só uma rota (`/admin/turmas/[id]`); virou modal porque abrir
 * uma turma é consulta dentro da lista, não uma viagem para fora dela: quem
 * confere lotação abre três turmas seguidas e volta, e cada volta custava um
 * carregamento de página inteiro. A rota continua existindo (link direto,
 * favorito, aba nova) — este modal é o caminho de dentro da lista.
 *
 * A abertura é um movimento só, no modelo do sistema empresarial: o painel
 * nasce como o cartão "Abrindo turma" (cabeçalho + fio de progresso) e, quando
 * os dados chegam, o MESMO painel cresce para a ficha inteira. O cabeçalho
 * nunca é remontado, então ele viaja junto no crescimento em vez de piscar.
 *
 * Divisão das libs, como no resto do painel: Framer Motion cuida do ciclo de
 * vida do React (crescimento do painel, abas, entrada e saída) e GSAP +
 * ScrollTrigger cuidam do que depende da rolagem do corpo da ficha (cascata
 * dos blocos, fio de progresso, cabeçalho que encolhe).
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getGroupFichaAction, type GroupFicha } from "@/actions/admin/group-detail";
import { useArea } from "@/components/features/admin/area-context";
import { DetailRow } from "@/components/ui/detail-panel";
import {
  CalendarIcon,
  ClockIcon,
  CloseIcon,
  GraduationIcon,
  GroupsIcon,
  PencilIcon,
  PowerIcon,
  TaskIcon,
  UserIcon,
} from "@/components/ui/icons";
import { LogoLoader } from "@/components/ui/logo-loader";
import { cn } from "@/lib/utils";
import { EnrollStudentForm } from "./enroll-student-form";
import { GroupSessions } from "./group-sessions";
import {
  CoursePill,
  GroupStatusPill,
  LevelPill,
  OccupancyRing,
  TeacherPill,
} from "./groups-visuals";
import {
  WEEKDAY_LONG,
  formatMinutes,
  occupancyLabel,
  occupancyTone,
  periodLabel,
  seatsLeft,
  sortedSchedule,
  weeklyMinutes,
  type Group,
} from "./groups-utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type FichaTab = "visao" | "matriculas" | "sessoes";
/** `abrindo` = cartão compacto com o fio de progresso; `aberta` = ficha inteira. */
type Fase = "abrindo" | "aberta";

const TABS: { id: FichaTab; label: string; icon: typeof GroupsIcon }[] = [
  { id: "visao", label: "Visão geral", icon: GroupsIcon },
  { id: "matriculas", label: "Matrículas", icon: UserIcon },
  { id: "sessoes", label: "Sessões", icon: CalendarIcon },
];

/**
 * Piso de tempo do estágio "Abrindo turma". A leitura costuma voltar em
 * poucos centésimos e, sem esse piso, o cartão viraria ficha antes de ser
 * lido — o que se vê é um salto, não uma abertura.
 */
const DURACAO_ABERTURA = 700;

/** Mola compartilhada pelo crescimento do painel — cartão e ficha usam a mesma. */
const MOLA = { type: "spring", stiffness: 260, damping: 32 } as const;

interface GroupFichaModalProps {
  /** Turma aberta; `null` fecha o modal. */
  group: Group | null;
  onClose: () => void;
  onEdit?: (group: Group) => void;
  onToggleActive?: (group: Group) => void;
  busy?: boolean;
}

export function GroupFichaModal({
  group,
  onClose,
  onEdit,
  onToggleActive,
  busy = false,
}: GroupFichaModalProps) {
  const reduceMotion = useReducedMotion();
  const { canManageGroups } = useArea();

  const [tab, setTab] = useState<FichaTab>("visao");
  const [fase, setFase] = useState<Fase>("abrindo");
  const [tempoMinimoOk, setTempoMinimoOk] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [ficha, setFicha] = useState<GroupFicha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [condensado, setCondensado] = useState(false);

  const corpoRef = useRef<HTMLDivElement>(null);
  const internoRef = useRef<HTMLDivElement>(null);
  const fioRef = useRef<HTMLSpanElement>(null);

  const groupId = group?.id ?? null;
  const temFicha = ficha !== null;

  /**
   * As mutações de dentro da ficha (matricular, remarcar, arquivar) chamam
   * `router.refresh()`, e a lista repassa a turma já atualizada. Esta chave
   * resume o que muda lá e força a releitura — sem ela a ficha continuaria
   * mostrando o retrato de quando abriu.
   */
  const revisao = group
    ? `${group.enrolledCount}|${group.isActive}|${group.maxStudents}|${group.schedule.length}|${group.name}`
    : "";

  // Cada turma recomeça a sequência: volta ao cartão e reabre o cronômetro.
  useEffect(() => {
    if (!groupId) return;
    setTab("visao");
    setFase("abrindo");
    setTempoMinimoOk(false);
    setCondensado(false);
    setErro(null);
    const timer = window.setTimeout(
      () => setTempoMinimoOk(true),
      reduceMotion ? 80 : DURACAO_ABERTURA,
    );
    return () => window.clearTimeout(timer);
  }, [groupId, reduceMotion]);

  const carregar = useCallback(async () => {
    if (!groupId) return;
    setCarregando(true);
    try {
      const dados = await getGroupFichaAction(groupId);
      if (!dados) {
        setErro("Turma não encontrada ou fora do seu alcance.");
        setFicha(null);
        return;
      }
      setErro(null);
      setFicha(dados);
    } catch {
      setErro("Não foi possível carregar a turma.");
      setFicha(null);
    } finally {
      setCarregando(false);
    }
  }, [groupId]);

  // `revisao` entra de propósito na lista: é o sinal de que a lista trouxe
  // dado novo (matrícula, arquivamento, edição) e a ficha precisa reler.
  useEffect(() => {
    if (!groupId) return;
    void carregar();
  }, [groupId, revisao, carregar]);

  // O painel só cresce quando as duas pontas estão prontas: o piso de tempo da
  // animação e os dados carregados. Assim a ficha nunca abre vazia. A fase só
  // anda para frente — uma releitura depois de matricular não volta ao cartão.
  useEffect(() => {
    if (tempoMinimoOk && !carregando) setFase("aberta");
  }, [tempoMinimoOk, carregando]);

  // Fecha no Esc e trava a rolagem do fundo enquanto a ficha está aberta.
  useEffect(() => {
    if (!groupId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Diálogo aberto por dentro da ficha (remarcar sessão, conflito de
      // matrícula) trata o próprio Esc. Sem esta guarda, cancelar um deles
      // levaria a ficha inteira embora junto.
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [groupId, onClose]);

  /**
   * Rolagem do corpo da ficha, tudo em GSAP:
   *
   * - os blocos que já nascem visíveis entram em cascata;
   * - os que estão abaixo da dobra esperam a rolagem chegar neles
   *   (ScrollTrigger com `once`, para não repetir a cada ida e volta);
   * - o fio no topo é o progresso da rolagem, em `scrub`;
   * - o cabeçalho encolhe assim que o corpo sai do topo.
   */
  useLayoutEffect(() => {
    if (fase !== "aberta" || reduceMotion) return;
    const scroller = corpoRef.current;
    const interno = internoRef.current;
    if (!scroller || !interno) return;

    const ctx = gsap.context(() => {
      const blocos = gsap.utils.toArray<HTMLElement>("[data-ficha-reveal]");
      const dobra = scroller.getBoundingClientRect();
      const visiveis: HTMLElement[] = [];
      const abaixo: HTMLElement[] = [];
      for (const bloco of blocos) {
        const topo = bloco.getBoundingClientRect().top - dobra.top;
        (topo < dobra.height - 48 ? visiveis : abaixo).push(bloco);
      }

      if (visiveis.length > 0) {
        gsap.fromTo(
          visiveis,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: "power3.out",
            stagger: 0.055,
            delay: 0.06,
          },
        );
      }

      for (const bloco of abaixo) {
        gsap.fromTo(
          bloco,
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: "power3.out",
            scrollTrigger: { scroller, trigger: bloco, start: "top 92%", once: true },
          },
        );
      }

      if (fioRef.current) {
        gsap.fromTo(
          fioRef.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              scroller,
              trigger: interno,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.3,
            },
          },
        );
      }

      ScrollTrigger.create({
        scroller,
        trigger: interno,
        start: "top top-=12",
        end: "max",
        onToggle: (self) => setCondensado(self.isActive),
      });
    }, scroller);

    // O painel ainda está crescendo na mola do Framer quando os gatilhos
    // nascem; sem o recálculo eles ficariam medindo a altura do cartão.
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 420);

    return () => {
      window.clearTimeout(refresh);
      ctx.revert();
    };
    // `temFicha` é presença, não identidade: uma releitura depois de
    // matricular não pode fazer o conteúdo inteiro entrar de novo.
  }, [fase, tab, reduceMotion, temFicha]);

  const abrindo = fase === "abrindo";
  const tone = group ? occupancyTone(group) : undefined;
  const periodo = group ? periodLabel(group) : null;

  const contagens = useMemo(() => {
    if (!ficha) return null;
    return {
      matriculados: ficha.activeCount,
      vagas: Math.max(0, ficha.group.maxStudents - ficha.activeCount),
      sessoes: ficha.sessions.length,
    };
  }, [ficha]);

  return (
    <AnimatePresence>
      {group ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Turma ${group.name}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(event) => {
            // Enquanto abre, o clique fora não fecha: o cartão está a meio
            // caminho de virar ficha, e fechar ali parece engasgo, não escolha.
            if (event.target === event.currentTarget && !abrindo) onClose();
          }}
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-navy-950/50 p-3 backdrop-blur-[3px] sm:p-6"
        >
          {/* `items-start` no fundo + painel sem `my-auto`: a borda de cima fica
              ancorada, então crescer só mexe na borda de baixo. */}
          <motion.div
            layout={reduceMotion ? false : true}
            initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
            transition={reduceMotion ? { duration: 0 } : MOLA}
            style={{ ["--tone" as string]: tone }}
            className={cn(
              "relative mt-[3vh] flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl",
              "border border-admin-border bg-admin-surface",
              "shadow-[0_1px_2px_rgba(11,26,51,0.06),0_40px_80px_-40px_rgba(11,26,51,0.55)]",
              abrindo ? "max-w-md" : "max-w-4xl",
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--gold-500)_14%,transparent),transparent_70%)]"
            />

            {/* Cabeçalho — o mesmo nó nas duas fases, por isso ele cresce em
                vez de trocar. `shrink-0` mantém ele fora da rolagem. */}
            <motion.header
              layout={reduceMotion ? false : "position"}
              data-condensed={condensado}
              className={cn(
                "relative flex shrink-0 items-start gap-4 px-4 sm:px-6",
                "transition-[padding] duration-300",
                condensado ? "py-3" : "py-4 sm:py-5",
              )}
            >
              <motion.div
                layout={reduceMotion ? false : true}
                transition={reduceMotion ? { duration: 0 } : MOLA}
                animate={{ scale: condensado ? 0.66 : 1 }}
                style={{ originX: 0, originY: 0.5 }}
                className="shrink-0"
              >
                <OccupancyRing group={group} size={abrindo ? 72 : 80} />
              </motion.div>

              <div className="min-w-0 flex-1">
                <AnimatePresence initial={false}>
                  {abrindo ? (
                    <motion.p
                      key="rotulo"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-admin-foreground/45"
                    >
                      Abrindo turma
                    </motion.p>
                  ) : null}
                </AnimatePresence>

                <motion.h2
                  layout={reduceMotion ? false : "position"}
                  className={cn(
                    "truncate font-semibold text-admin-foreground transition-[font-size] duration-300",
                    condensado ? "text-lg" : "text-xl sm:text-2xl",
                  )}
                >
                  {group.name}
                </motion.h2>

                <p className="mt-0.5 text-sm font-medium" style={{ color: tone }}>
                  {occupancyLabel(group)} · {group.enrolledCount} de {group.maxStudents}{" "}
                  lugares
                </p>

                <AnimatePresence initial={false}>
                  {condensado ? null : (
                    <motion.div
                      key="selos"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <GroupStatusPill isActive={group.isActive} />
                        <LevelPill level={group.level} />
                        <TeacherPill id={group.teacherId} name={group.teacherName} />
                        {!abrindo && <CoursePill name={group.courseName} />}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <AnimatePresence initial={false}>
                  {abrindo ? null : (
                    <motion.button
                      key="fechar"
                      type="button"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      onClick={onClose}
                      aria-label="Fechar ficha da turma"
                      className="grid h-9 w-9 place-items-center rounded-lg border border-admin-border text-admin-foreground/50 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.header>

            {/* Corpo — `popLayout` tira o fio de progresso do fluxo enquanto ele
                some, então a ficha já ocupa o espaço e o painel cresce numa
                tacada só, sem o encolhe-e-cresce de uma troca em sequência. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {abrindo ? (
                <motion.div
                  key="progresso"
                  layout={reduceMotion ? false : "position"}
                  exit={{ opacity: 0, transition: { duration: 0.14 } }}
                  className="relative shrink-0 px-5 pb-5"
                >
                  <div className="h-1 w-full overflow-hidden rounded-full bg-admin-muted">
                    <motion.span
                      className="block h-full rounded-full bg-gradient-to-r from-navy-700 to-gold-500"
                      initial={{ width: "8%" }}
                      animate={{ width: "100%" }}
                      transition={{
                        duration: reduceMotion ? 0.1 : DURACAO_ABERTURA / 1000,
                        ease: "easeInOut",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-admin-foreground/50">
                    Carregando matrículas, grade e sessões...
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="ficha"
                  layout={reduceMotion ? false : "position"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.22, delay: 0.04 } }}
                  className="relative flex min-h-0 flex-1 flex-col"
                >
                  <div className="relative flex shrink-0 flex-col gap-2 border-y border-admin-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <nav
                      role="tablist"
                      aria-label="Seções da turma"
                      className="-mx-1 flex gap-1 overflow-x-auto px-1"
                    >
                      {TABS.map((item) => {
                        const ativa = tab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={ativa}
                            onClick={() => setTab(item.id)}
                            className={cn(
                              "relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                              ativa
                                ? "text-admin-foreground"
                                : "text-admin-foreground/50 hover:text-admin-foreground",
                            )}
                          >
                            {ativa && (
                              <motion.span
                                layoutId="du-ficha-turma-aba"
                                aria-hidden
                                className="absolute inset-0 rounded-lg bg-admin-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold-500)_30%,transparent)]"
                                transition={
                                  reduceMotion
                                    ? { duration: 0 }
                                    : { type: "spring", stiffness: 480, damping: 38 }
                                }
                              />
                            )}
                            <item.icon className="relative h-4 w-4" />
                            <span className="relative">{item.label}</span>
                          </button>
                        );
                      })}
                    </nav>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(group)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gold-400/60 px-3 py-1.5 text-xs font-medium text-gold-700 transition-colors hover:bg-gold-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-40"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      )}
                      {canManageGroups && onToggleActive && (
                        <button
                          type="button"
                          onClick={() => onToggleActive(group)}
                          disabled={busy}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-40",
                            group.isActive
                              ? "border-destructive/35 text-destructive hover:bg-destructive/10"
                              : "border-admin-border text-admin-foreground/70 hover:bg-admin-muted",
                          )}
                        >
                          {busy ? (
                            <LogoLoader size={14} label={null} />
                          ) : (
                            <PowerIcon className="h-3.5 w-3.5" />
                          )}
                          {group.isActive ? "Arquivar" : "Reativar"}
                        </button>
                      )}
                    </div>

                    {/* Fio de progresso da rolagem do corpo — GSAP, em scrub. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden"
                    >
                      <span
                        ref={fioRef}
                        className="block h-full w-full origin-left scale-x-0 bg-gradient-to-r from-navy-700 to-gold-500"
                      />
                    </span>
                  </div>

                  <div
                    ref={corpoRef}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                  >
                    <div ref={internoRef} className="px-4 py-5 sm:px-6 sm:py-6">
                      {erro ? (
                        <p
                          role="alert"
                          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive"
                        >
                          {erro}
                        </p>
                      ) : !ficha ? (
                        <div className="grid place-items-center py-16">
                          <LogoLoader size={28} label="Carregando turma" />
                        </div>
                      ) : (
                        // A entrada do conteúdo é do GSAP (a cascata dos
                        // blocos, no efeito acima), não do Framer: duas libs
                        // animando o mesmo nó brigariam pelo `transform`.
                        <div key={tab} className="space-y-6">
                          {tab === "visao" && (
                            <VisaoGeral
                              group={ficha.group}
                              contagens={contagens}
                              periodo={periodo}
                            />
                          )}

                          {tab === "matriculas" && (
                            <section data-ficha-reveal>
                              <BlocoTitulo
                                titulo="Matrículas"
                                hint={`${ficha.activeCount}/${ficha.group.maxStudents}`}
                              />
                              <EnrollStudentForm
                                groupId={ficha.group.id}
                                groupName={ficha.group.name}
                                enrollments={ficha.enrollments}
                                students={ficha.students}
                                activeByStudent={ficha.activeByStudent}
                                seatsLeft={Math.max(
                                  0,
                                  ficha.group.maxStudents - ficha.activeCount,
                                )}
                              />
                            </section>
                          )}

                          {tab === "sessoes" && (
                            <section data-ficha-reveal>
                              <BlocoTitulo
                                titulo="Sessões"
                                hint={`${ficha.sessions.length} no total`}
                              />
                              <GroupSessions
                                sessions={ficha.sessions}
                                previews={ficha.previews}
                                groupId={ficha.group.id}
                                groupName={ficha.group.name}
                                canManage
                              />
                            </section>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function BlocoTitulo({ titulo, hint }: { titulo: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">
        {titulo}
      </h3>
      {hint && <span className="text-xs tabular text-admin-foreground/45">{hint}</span>}
    </div>
  );
}

function VisaoGeral({
  group,
  contagens,
  periodo,
}: {
  group: Group;
  contagens: { matriculados: number; vagas: number; sessoes: number } | null;
  periodo: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const grade = sortedSchedule(group.schedule);

  return (
    <>
      <section data-ficha-reveal>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metrica
            icon={UserIcon}
            label="Matriculados"
            value={contagens?.matriculados ?? group.enrolledCount}
          />
          <Metrica icon={GroupsIcon} label="Vagas livres" value={seatsLeft(group)} />
          <Metrica icon={CalendarIcon} label="Sessões" value={contagens?.sessoes ?? 0} />
          <Metrica
            icon={ClockIcon}
            label="Carga semanal"
            text={formatMinutes(weeklyMinutes(group.schedule))}
          />
        </div>
      </section>

      <section data-ficha-reveal>
        <BlocoTitulo titulo="Grade semanal" />
        {grade.length === 0 ? (
          <p className="rounded-xl border border-dashed border-admin-border px-4 py-6 text-center text-sm text-admin-foreground/50">
            Nenhum horário definido — sem grade, o sistema não gera as sessões da turma.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-admin-border">
            {grade.map((entry, index) => (
              <motion.li
                key={`${entry.weekday}-${entry.start}-${index}`}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.28,
                  delay: index * 0.04,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex items-center justify-between gap-3 border-b border-admin-border bg-admin-surface px-3.5 py-2.5 text-sm last:border-0"
              >
                <span className="flex items-center gap-2.5 text-admin-foreground">
                  <span
                    aria-hidden
                    className="grid h-7 w-7 place-items-center rounded-lg bg-gold-50 text-[10px] font-semibold uppercase text-gold-700"
                  >
                    {WEEKDAY_LONG[entry.weekday]?.slice(0, 3)}
                  </span>
                  {WEEKDAY_LONG[entry.weekday]}
                </span>
                <span className="tabular text-admin-foreground/70">
                  {entry.start} – {entry.end}
                </span>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <section data-ficha-reveal>
        <BlocoTitulo titulo="Dados da turma" />
        <DetailRow
          icon={UserIcon}
          label="Professor responsável"
          value={group.teacherName}
        />
        <DetailRow icon={GraduationIcon} label="Curso" value={group.courseName} />
        <DetailRow icon={GroupsIcon} label="Nível (CEFR)" value={group.level} />
        <DetailRow
          icon={TaskIcon}
          label="Lotação máxima"
          value={`${group.maxStudents} alunos`}
        />
        <DetailRow icon={CalendarIcon} label="Período" value={periodo} />
      </section>
    </>
  );
}

function Metrica({
  icon: Icon,
  label,
  value,
  text,
}: {
  icon: typeof GroupsIcon;
  label: string;
  value?: number;
  text?: string;
}) {
  return (
    <div className="rounded-xl border border-admin-border bg-admin-surface px-3.5 py-3">
      <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className="mt-1 text-lg font-semibold tabular text-admin-foreground">
        {text ?? value}
      </p>
    </div>
  );
}
