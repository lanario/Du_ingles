"use client";

/**
 * Ficha do aluno em modal — espelho do `group-ficha-modal` para a área de
 * alunos do admin/professor.
 *
 * Abre a ficha imediatamente, preenche os detalhes sob demanda e reaproveita
 * os dados recentes da lista para acelerar a reabertura.
 *
 * Divisão de libs idêntica ao modal de turmas:
 *  - Framer Motion → ciclo de vida React (crescimento do painel, entrada/saída)
 *  - GSAP + ScrollTrigger → animações dependentes de rolagem (cascata de
 *    blocos, fio de progresso em scrub, cabeçalho que encolhe)
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { StudentFichaData } from "@/actions/admin/users-detail";
import { useArea } from "@/components/features/admin/area-context";
import { EditUserForm } from "@/components/features/admin/users/edit-user-form";
import { SetPasswordForm } from "@/components/features/admin/users/set-password-form";
import { UserLifecycleActions } from "@/components/features/admin/users/user-lifecycle-actions";
import { DetailRow } from "@/components/ui/detail-panel";
import {
  CalendarIcon,
  CloseIcon,
  GraduationIcon,
  MailIcon,
  SwapIcon,
  UserIcon,
} from "@/components/ui/icons";
import { LogoLoader } from "@/components/ui/logo-loader";
import { cn } from "@/lib/utils";
import { StudentObjectives } from "./student-objectives";
import {
  CopyButton,
  GroupPill,
  LevelPill,
  PendingPasswordPill,
  StatusPill,
  UserAvatar,
} from "./students-visuals";
import { formatDate, type Student } from "./students-utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Fase mantida para as animações de rolagem; a ficha abre diretamente. */
type Fase = "abrindo" | "aberta";

/** Mola compartilhada pelo crescimento do painel (cartão e ficha usam a mesma). */
const MOLA = { type: "spring", stiffness: 260, damping: 32 } as const;

interface StudentFichaModalProps {
  /** Aluno aberto (linha básica); `null` fecha o modal. */
  student: Student | null;
  cachedDetail: StudentFichaData | null;
  loadDetail: (studentId: string) => Promise<StudentFichaData | null>;
  onClose: () => void;
  onMove?: () => void;
  canManage?: boolean;
}

export function StudentFichaModal({
  student,
  cachedDetail,
  loadDetail,
  onClose,
  onMove,
  canManage = true,
}: StudentFichaModalProps) {
  const reduceMotion = useReducedMotion();
  const { canManagePeople } = useArea();
  const podeGerenciar = canManage && canManagePeople;

  const [fase, setFase] = useState<Fase>("aberta");
  const [ficha, setFicha] = useState<StudentFichaData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [condensado, setCondensado] = useState(false);
  /** Muda a cada abertura para forçar remonte do conteúdo com novas animações. */
  const [session, setSession] = useState(0);
  const temFicha = ficha !== null;

  const corpoRef = useRef<HTMLDivElement>(null);
  const internoRef = useRef<HTMLDivElement>(null);
  const fioRef = useRef<HTMLSpanElement>(null);

  const studentId = student?.id ?? null;

  /**
   * Resume o que muda no aluno — nome, telefone, nível, status, turma.
   * Quando o aluno edita seus dados e o `router.refresh()` entrega o prop
   * `student` atualizado, `revisao` muda e a ficha relê em silêncio (sem
   * voltar ao estágio "abrindo" — o painel já está aberto).
   * Mesmo padrão do `group-ficha-modal`.
   */
  const revisao = student
    ? `${student.fullName}|${student.email}|${student.isActive}|${student.currentLevel}|${student.groupName ?? ""}|${student.guardianName ?? ""}`
    : "";

  // Cada aluno começa com o painel aberto; o conteúdo aparece assim que chega.
  useEffect(() => {
    if (!studentId) return;
    setFase("aberta");
    setCondensado(false);
    setErro(null);
    setSession((n) => n + 1);
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setErro(null);
    setFicha(cachedDetail);
    if (cachedDetail)
      return () => {
        cancelled = true;
      };
    void loadDetail(studentId)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setErro("Aluno não encontrado ou fora do seu alcance.");
          return;
        }
        setFicha(data);
      })
      .catch(() => {
        if (!cancelled) setErro("Não foi possível carregar os dados do aluno.");
      });
    return () => {
      cancelled = true;
    };
    // `revisao` recarrega silenciosamente quando a lista entrega dados novos.
  }, [studentId, revisao, cachedDetail, loadDetail]);

  // Fecha no Esc e trava a rolagem do fundo enquanto a ficha está aberta.
  useEffect(() => {
    if (!studentId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Diálogos internos (confirmar ação, etc.) tratam o próprio Esc.
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
  }, [studentId, onClose]);

  /**
   * Animações de rolagem em GSAP — idênticas ao modal de turmas:
   *  - blocos visíveis entram em cascata no mount;
   *  - blocos abaixo da dobra entram via ScrollTrigger;
   *  - fio de progresso em scrub;
   *  - cabeçalho encolhe quando o corpo rola.
   */
  useLayoutEffect(() => {
    if (fase !== "aberta" || reduceMotion || !temFicha) return;
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

    // O painel ainda está crescendo quando os gatilhos nascem; sem o recálculo
    // eles mediriam a altura do cartão.
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 420);

    return () => {
      window.clearTimeout(refresh);
      ctx.revert();
    };
  }, [fase, reduceMotion, temFicha]);

  const abrindo = fase === "abrindo";

  return (
    <AnimatePresence>
      {student ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Aluno ${student.fullName}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(event) => {
            // Durante a abertura, o clique fora não fecha — seria percebido
            // como engasgo, não escolha.
            if (event.target === event.currentTarget && !abrindo) onClose();
          }}
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-navy-950/50 p-3 backdrop-blur-[3px] sm:p-6"
        >
          {/* `items-start` ancora a borda de cima; crescer só move a borda de baixo. */}
          <motion.div
            layout={reduceMotion ? false : true}
            initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
            transition={reduceMotion ? { duration: 0 } : MOLA}
            className={cn(
              "relative mt-[3vh] flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl",
              "border border-admin-border bg-admin-surface",
              "shadow-[0_1px_2px_rgba(11,26,51,0.06),0_40px_80px_-40px_rgba(11,26,51,0.55)]",
              abrindo ? "max-w-sm" : "max-w-2xl",
            )}
          >
            {/* Gradiente decorativo no topo */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--gold-500)_12%,transparent),transparent_70%)]"
            />

            {/* ── Cabeçalho — mesmo nó nas duas fases, viaja junto no crescimento ── */}
            <motion.header
              layout={reduceMotion ? false : "position"}
              data-condensed={condensado}
              className={cn(
                "relative flex shrink-0 items-start gap-4 px-4 sm:px-6",
                "transition-[padding] duration-300",
                condensado ? "py-3" : "py-4 sm:py-5",
              )}
            >
              {/* Avatar do aluno com escala condensada */}
              <motion.div
                layout={reduceMotion ? false : true}
                transition={reduceMotion ? { duration: 0 } : MOLA}
                animate={{ scale: condensado ? 0.72 : 1 }}
                style={{ originX: 0, originY: 0.5 }}
                className="shrink-0"
              >
                <UserAvatar
                  id={student.id}
                  name={student.fullName}
                  size={abrindo ? "sm" : "md"}
                />
              </motion.div>

              <div className="min-w-0 flex-1">
                {/* Rótulo "Abrindo aluno" — some quando a ficha abre */}
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
                      Abrindo aluno
                    </motion.p>
                  ) : null}
                </AnimatePresence>

                <motion.h2
                  layout={reduceMotion ? false : "position"}
                  className={cn(
                    "truncate font-semibold text-admin-foreground transition-[font-size] duration-300",
                    condensado ? "text-base" : "text-xl sm:text-2xl",
                  )}
                >
                  {student.fullName}
                </motion.h2>

                <p className="mt-0.5 text-sm font-medium text-admin-foreground/60">
                  {student.email}
                </p>

                {/* Selos — somem quando condensado, aparecem quando aberta */}
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
                        <StatusPill isActive={student.isActive} />
                        {!abrindo && (
                          <>
                            <LevelPill level={student.currentLevel} />
                            <GroupPill
                              name={student.groupName}
                              level={student.groupLevel}
                            />
                            {student.mustChangePassword && <PendingPasswordPill />}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Botão de fechar — só aparece na fase aberta */}
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
                      aria-label="Fechar ficha do aluno"
                      className="grid h-9 w-9 place-items-center rounded-lg border border-admin-border text-admin-foreground/50 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.header>

            {/* ── Corpo — `popLayout` mantém o fio fora do fluxo enquanto some ── */}
            <AnimatePresence mode="popLayout" initial={false}>
              {abrindo ? (
                /* Fase de carregamento: barra de progresso animada */
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
                        duration: reduceMotion ? 0.1 : 0.18,
                        ease: "easeInOut",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-admin-foreground/50">
                    Carregando dados do aluno...
                  </p>
                </motion.div>
              ) : (
                /* Fase aberta: ficha completa com GSAP */
                <motion.div
                  key="ficha"
                  layout={reduceMotion ? false : "position"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.22, delay: 0.04 } }}
                  className="relative flex min-h-0 flex-1 flex-col"
                >
                  {/* Barra divisória com fio de progresso de rolagem (GSAP scrub) */}
                  <div className="relative shrink-0 border-t border-admin-border">
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

                  {/* Corpo rolável */}
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
                          <LogoLoader size={28} label="Carregando aluno" />
                        </div>
                      ) : (
                        <FichaConteudo
                          key={session}
                          ficha={ficha.user}
                          initialObjectives={ficha.objectives}
                          student={student}
                          podeGerenciar={podeGerenciar}
                          onMove={onMove}
                        />
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

// ── Conteúdo da ficha ────────────────────────────────────────────────────────

function FichaConteudo({
  ficha,
  initialObjectives,
  student,
  podeGerenciar,
  onMove,
}: {
  ficha: import("@/repositories/users").UserDetail;
  initialObjectives: import("@/repositories/objectives").ObjectiveItem[];
  student: Student;
  podeGerenciar: boolean;
  onMove?: () => void;
}) {
  const guardianEmail = ficha.studentProfile?.guardianEmail ?? null;
  const guardianPhone = ficha.studentProfile?.guardianPhone ?? null;
  const hasGuardian = Boolean(student.guardianName || guardianEmail || guardianPhone);

  return (
    <div className="space-y-6">
      {/* Ações rápidas */}
      {podeGerenciar && (
        <section data-ficha-reveal>
          <BlocoTitulo titulo="Ações" />
          <UserLifecycleActions user={ficha} />
        </section>
      )}

      {/* Turma */}
      <section data-ficha-reveal>
        <BlocoTitulo titulo="Turma" />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-admin-border px-3.5 py-3">
          <GroupPill name={student.groupName} level={student.groupLevel} />
          {podeGerenciar && onMove && (
            <button
              type="button"
              onClick={onMove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold-400/60 px-3 py-1.5 text-xs font-medium text-gold-700 transition-colors hover:bg-gold-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              <SwapIcon className="h-3.5 w-3.5" />
              Mover
            </button>
          )}
        </div>
      </section>

      {/* Objetivos */}
      <section data-ficha-reveal>
        <BlocoTitulo titulo="Objetivos" />
        <StudentObjectives
          studentId={ficha.id}
          canManage
          initialObjectives={initialObjectives}
        />
      </section>

      {/* Responsável */}
      {hasGuardian && (
        <section data-ficha-reveal>
          <BlocoTitulo titulo="Responsável" />
          <div className="rounded-xl border border-admin-border px-3.5">
            <DetailRow icon={UserIcon} label="Nome" value={student.guardianName} />
            <DetailRow
              icon={MailIcon}
              label="E-mail"
              value={guardianEmail}
              href={guardianEmail ? `mailto:${guardianEmail}` : undefined}
            />
            <DetailRow icon={UserIcon} label="Telefone" value={guardianPhone} />
          </div>
        </section>
      )}

      {/* Senha */}
      {podeGerenciar && ficha.role !== "admin" && (
        <section data-ficha-reveal>
          <BlocoTitulo titulo="Senha" />
          <SetPasswordForm
            userId={ficha.id}
            userName={ficha.fullName.split(" ")[0] ?? "o aluno"}
          />
        </section>
      )}

      {/* Contato */}
      <section data-ficha-reveal>
        <BlocoTitulo titulo="Contato" />
        <div className="rounded-xl border border-admin-border px-3.5">
          <DetailRow
            icon={MailIcon}
            label="E-mail"
            value={ficha.email}
            href={`mailto:${ficha.email}`}
            action={
              <CopyButton
                value={ficha.email}
                label={`Copiar e-mail de ${ficha.fullName}`}
              />
            }
          />
          <DetailRow icon={UserIcon} label="Telefone" value={ficha.phone} />
          <DetailRow
            icon={CalendarIcon}
            label="Aluno desde"
            value={formatDate(ficha.createdAt)}
          />
        </div>
      </section>

      {/* Dados cadastrais */}
      {podeGerenciar && (
        <section data-ficha-reveal>
          <BlocoTitulo titulo="Dados cadastrais" />
          <EditUserForm user={ficha} />
        </section>
      )}

      {/* Nível CEFR */}
      <section data-ficha-reveal>
        <BlocoTitulo titulo="Nível" />
        <div className="flex items-center gap-2 rounded-xl border border-admin-border px-3.5 py-3">
          <GraduationIcon className="h-4 w-4 shrink-0 text-admin-foreground/50" />
          <span className="text-sm text-admin-foreground">
            {student.currentLevel}
            <span className="ml-1.5 text-xs text-admin-foreground/50">(CEFR)</span>
          </span>
          <LevelPill level={student.currentLevel} className="ml-auto" />
        </div>
      </section>
    </div>
  );
}

function BlocoTitulo({ titulo, hint }: { titulo: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">
        {titulo}
      </h3>
      {hint && (
        <span className="text-xs tabular-nums text-admin-foreground/45">{hint}</span>
      )}
    </div>
  );
}
