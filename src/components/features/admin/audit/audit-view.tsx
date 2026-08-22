"use client";

/**
 * Auditoria: a linha do tempo do que aconteceu na escola.
 *
 * A tela é de leitura e varredura — não de operação. Por isso o formato é uma
 * timeline agrupada por dia, e não uma tabela: o admin quase sempre chega
 * aqui perguntando "o que mudou ontem?", não "qual o valor da célula X".
 *
 * Cada linha é uma frase em português (`audit-utils`), com o detalhe técnico
 * escondido atrás de um clique — quem precisa do metadata acha, quem não
 * precisa não tropeça nele.
 *
 * Movimento, mesma divisão do resto do painel: **Framer Motion** cuida do
 * ciclo de vida do React (entrada escalonada, troca de filtro, abertura do
 * detalhe) e **GSAP + ScrollTrigger** do que depende da rolagem (barra que
 * gruda, fio de progresso e o traço da timeline). Nenhum nó é animado pelas
 * duas ao mesmo tempo.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useListProgress, useStickyBar } from "@/components/motion/list-motion";
import { ChevronIcon, CloseIcon, SearchIcon, ShieldIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { AuditLogEntry } from "@/repositories/audit";
import {
  CATEGORY_COPY,
  PERIOD_LABEL,
  dayKey,
  dayTitle,
  describe,
  detailsOf,
  matches,
  relativeTime,
  roleLabel,
  timeLabel,
  withinPeriod,
  type AuditCategory,
  type AuditDescription,
  type AuditDetail,
  type PeriodFilter,
} from "./audit-utils";
import {
  ActorAvatar,
  CategoryChip,
  EventMedal,
  Indicator,
  SeverityBadge,
} from "./audit-visuals";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const CATEGORIES = Object.keys(CATEGORY_COPY) as AuditCategory[];
const PERIODS: PeriodFilter[] = ["hoje", "7d", "30d", "tudo"];

interface PreparedEntry {
  entry: AuditLogEntry;
  copy: AuditDescription;
  details: AuditDetail[];
}

interface AuditViewProps {
  logs: AuditLogEntry[];
  /** Quantos registros a página pediu ao banco — vira nota de rodapé. */
  limit: number;
}

export function AuditView({ logs, limit }: AuditViewProps) {
  const reduceMotion = useReducedMotion();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AuditCategory | "todas">("todas");
  const [period, setPeriod] = useState<PeriodFilter>("30d");

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { sentinelRef, barRef } = useStickyBar<HTMLDivElement>();
  const lineRef = useListProgress(listRef);

  const prepared = useMemo<PreparedEntry[]>(
    () =>
      logs.map((entry) => ({
        entry,
        copy: describe(entry),
        details: detailsOf(entry),
      })),
    [logs],
  );

  /** Contagens do período escolhido — as abas mostram o que existe ali. */
  const inPeriod = useMemo(
    () => prepared.filter((item) => withinPeriod(item.entry.createdAt, period)),
    [prepared, period],
  );

  const counts = useMemo(() => {
    const map = new Map<AuditCategory, number>();
    for (const item of inPeriod) {
      map.set(item.copy.category, (map.get(item.copy.category) ?? 0) + 1);
    }
    return map;
  }, [inPeriod]);

  const filtered = useMemo(
    () =>
      inPeriod
        .filter((item) => category === "todas" || item.copy.category === category)
        .filter((item) => matches(item.entry, search)),
    [inPeriod, category, search],
  );

  const groups = useMemo(() => {
    const byDay = new Map<string, PreparedEntry[]>();
    for (const item of filtered) {
      const key = dayKey(item.entry.createdAt);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(item);
      else byDay.set(key, [item]);
    }
    return [...byDay.entries()]
      .filter(([, items]) => items.length > 0)
      .map(([key, items]) => ({
        key,
        title: dayTitle(items[0]!.entry.createdAt),
        items,
      }));
  }, [filtered]);

  const stats = useMemo(() => {
    const today = dayKey(new Date().toISOString());
    return {
      total: prepared.length,
      hoje: prepared.filter((item) => dayKey(item.entry.createdAt) === today).length,
      criticos: inPeriod.filter((item) => item.copy.severity === "critico").length,
      pessoas: new Set(inPeriod.map((item) => item.entry.actorId ?? item.copy.actor))
        .size,
    };
  }, [prepared, inPeriod]);

  // "/" leva direto para a busca, como no resto do painel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtering = search.trim() !== "" || category !== "todas";

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-navy-50 text-navy-800 ring-1 ring-navy-100">
              <ShieldIcon className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-semibold text-admin-foreground">Auditoria</h1>
          </div>
          <p className="mt-2 max-w-xl text-sm text-admin-foreground/60">
            Tudo o que foi feito na escola, em ordem — quem fez, o que mudou e quando.
            Clique numa linha para ver os detalhes do registro.
          </p>
        </div>

        <dl className="flex flex-wrap gap-2">
          <Indicator label="Registros" value={stats.total} />
          <Indicator label="Hoje" value={stats.hoje} tone="var(--navy-700)" />
          <Indicator label="Pessoas" value={stats.pessoas} tone="var(--gold-700)" />
          <Indicator
            label="Críticos"
            value={stats.criticos}
            tone={stats.criticos > 0 ? "var(--color-red-600, #dc2626)" : undefined}
          />
        </dl>
      </div>

      {/* Sentinela do ScrollTrigger: marca onde a barra passa a ficar grudada. */}
      <div ref={sentinelRef} aria-hidden className="mt-6 h-px" />

      <div
        ref={barRef}
        data-stuck="false"
        className={cn(
          "sticky top-0 z-30 -mx-4 mb-5 md:top-16 md:-mx-6 flex flex-wrap items-center gap-2 border-b border-transparent px-4 py-3 md:px-6",
          "bg-[color-mix(in_srgb,var(--admin-background)_88%,transparent)] backdrop-blur-md transition-[border-color,box-shadow] duration-300",
          "data-[stuck=true]:border-admin-border data-[stuck=true]:shadow-[0_18px_30px_-28px_rgba(11,26,51,0.35)]",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
        >
          <span
            ref={lineRef}
            className="block h-full w-full origin-left bg-gradient-to-r from-navy-700 to-gold-500"
          />
        </span>

        <div
          role="group"
          aria-label="Tipos de ação"
          className="flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1"
        >
          <FilterTab
            active={category === "todas"}
            onClick={() => setCategory("todas")}
            label="Tudo"
            count={inPeriod.length}
            reduceMotion={Boolean(reduceMotion)}
          />
          {CATEGORIES.map((item) => (
            <FilterTab
              key={item}
              active={category === item}
              onClick={() => setCategory(item)}
              label={CATEGORY_COPY[item].label}
              count={counts.get(item) ?? 0}
              reduceMotion={Boolean(reduceMotion)}
            />
          ))}
        </div>

        <div className="relative order-last w-full min-w-[12rem] flex-1 sm:order-none sm:w-auto">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-foreground/40" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar no histórico"
            placeholder="Buscar por pessoa, turma, valor..."
            className="w-full rounded-xl border border-admin-border bg-admin-surface py-2.5 pl-10 pr-10 text-sm text-admin-foreground outline-none transition-colors placeholder:text-admin-foreground/40 hover:border-gold-300 focus:border-gold-500 focus-visible:ring-2 focus-visible:ring-gold-500/35 [&::-webkit-search-cancel-button]:hidden"
          />
          <AnimatePresence>
            {search !== "" && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-admin-foreground/40 transition-colors hover:bg-admin-muted hover:text-admin-foreground"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div
          role="group"
          aria-label="Período"
          className="flex items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1"
        >
          {PERIODS.map((item) => {
            const active = period === item;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => setPeriod(item)}
                className={cn(
                  "relative rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                  active
                    ? "text-admin-foreground"
                    : "text-admin-foreground/50 hover:text-admin-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="du-auditoria-periodo"
                    aria-hidden
                    className="absolute inset-0 rounded-lg bg-admin-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--navy-500)_25%,transparent)]"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 480, damping: 38 }
                    }
                  />
                )}
                <span className="relative">{PERIOD_LABEL[item]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={listRef}>
        {groups.length === 0 ? (
          <EmptyState
            filtering={filtering}
            onClear={() => {
              setSearch("");
              setCategory("todas");
              setPeriod("tudo");
            }}
          />
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <DayGroup
                key={group.key}
                title={group.title}
                items={group.items}
                reduceMotion={Boolean(reduceMotion)}
              />
            ))}
          </div>
        )}
      </div>

      {logs.length >= limit && (
        <p className="mt-8 text-center text-xs text-admin-foreground/45">
          Mostrando os {limit} registros mais recentes.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba de filtro
// ---------------------------------------------------------------------------

function FilterTab({
  active,
  onClick,
  label,
  count,
  reduceMotion,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  reduceMotion: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        active
          ? "text-admin-foreground"
          : "text-admin-foreground/50 hover:text-admin-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="du-auditoria-aba"
          aria-hidden
          className="absolute inset-0 rounded-lg bg-admin-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold-500)_30%,transparent)]"
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 480, damping: 38 }
          }
        />
      )}
      <span className="relative flex items-center gap-1.5">
        {label}
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            active
              ? "bg-gold-100 text-gold-700"
              : "bg-admin-muted text-admin-foreground/50",
          )}
        >
          {count}
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Um dia da timeline
// ---------------------------------------------------------------------------

function DayGroup({
  title,
  items,
  reduceMotion,
}: {
  title: string;
  items: PreparedEntry[];
  reduceMotion: boolean;
}) {
  const railRef = useRef<HTMLSpanElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  /**
   * O traço vertical do dia é desenhado conforme a rolagem passa por ele —
   * GSAP com `scrub`, porque é progresso contínuo, não estado do React.
   */
  useEffect(() => {
    const rail = railRef.current;
    const group = groupRef.current;
    if (!rail || !group) return;

    if (reduceMotion) {
      gsap.set(rail, { scaleY: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        rail,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          transformOrigin: "top center",
          scrollTrigger: {
            trigger: group,
            start: "top 80%",
            end: "bottom 60%",
            scrub: 0.35,
          },
        },
      );
    }, group);

    return () => ctx.revert();
  }, [reduceMotion]);

  return (
    <section ref={groupRef}>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/60">
          {title}
        </h2>
        <span className="h-px flex-1 bg-gradient-to-r from-gold-300 to-transparent" />
        <span className="text-xs text-admin-foreground/45">
          {items.length} {items.length === 1 ? "ação" : "ações"}
        </span>
      </div>

      <div className="relative">
        {/* Trilho da timeline, atrás dos medalhões. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[1.625rem] top-2 bottom-2 w-px bg-admin-border"
        >
          <span
            ref={railRef}
            className="block h-full w-full origin-top scale-y-0 bg-gradient-to-b from-navy-300 via-gold-400 to-transparent"
          />
        </span>

        <motion.ul
          className="space-y-1.5"
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.035 } } }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((item) => (
              <AuditRow key={item.entry.id} item={item} reduceMotion={reduceMotion} />
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Linha do evento
// ---------------------------------------------------------------------------

function AuditRow({
  item,
  reduceMotion,
}: {
  item: PreparedEntry;
  reduceMotion: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { entry, copy, details } = item;
  const hasDetails = details.length > 0;

  return (
    <motion.li
      layout={!reduceMotion}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      className="relative"
    >
      <div
        className={cn(
          "group relative flex gap-3 rounded-2xl border border-transparent px-2 py-2.5 transition-colors",
          "hover:border-admin-border hover:bg-admin-surface",
          open && "border-admin-border bg-admin-surface",
        )}
      >
        <EventMedal icon={copy.icon} category={copy.category} severity={copy.severity} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm text-admin-foreground">
              <span className="font-semibold">{copy.actor}</span>{" "}
              <span className="text-admin-foreground/80">{copy.phrase}</span>
            </p>
            <SeverityBadge severity={copy.severity} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-admin-foreground/50">
            <ActorAvatar name={copy.actor} role={entry.actorRole} />
            <span>{roleLabel(entry.actorRole)}</span>
            <span aria-hidden>·</span>
            <time
              dateTime={entry.createdAt}
              title={new Date(entry.createdAt).toLocaleString("pt-BR")}
            >
              {timeLabel(entry.createdAt)}
            </time>
            <span aria-hidden>·</span>
            <span>{relativeTime(entry.createdAt)}</span>
            <CategoryChip category={copy.category} />
          </div>

          <AnimatePresence initial={false}>
            {open && hasDetails && (
              <motion.dl
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid gap-x-6 gap-y-2 rounded-xl bg-admin-muted/60 p-3 text-xs sm:grid-cols-2">
                  {details.map((detail) => (
                    <div key={`${detail.label}-${detail.value}`} className="min-w-0">
                      <dt className="text-[11px] uppercase tracking-[0.1em] text-admin-foreground/45">
                        {detail.label}
                      </dt>
                      <dd
                        className="truncate text-admin-foreground/80"
                        title={detail.value}
                      >
                        {detail.value}
                      </dd>
                    </div>
                  ))}
                </div>
              </motion.dl>
            )}
          </AnimatePresence>
        </div>

        {hasDetails && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Ocultar detalhes" : "Ver detalhes"}
            className={cn(
              "h-8 w-8 flex-none self-start rounded-lg text-admin-foreground/40 transition-colors",
              "hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
              "opacity-40 group-hover:opacity-100 focus-visible:opacity-100",
              open && "opacity-100",
            )}
          >
            <ChevronIcon
              className={cn(
                "mx-auto h-4 w-4 transition-transform duration-300",
                open ? "rotate-180" : "rotate-0",
              )}
            />
          </button>
        )}
      </div>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------
// Vazio
// ---------------------------------------------------------------------------

function EmptyState({ filtering, onClear }: { filtering: boolean; onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-dashed border-admin-border bg-admin-surface/50 px-6 py-14 text-center"
    >
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-navy-50 text-navy-700 ring-1 ring-navy-100">
        <ShieldIcon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-admin-foreground">
        {filtering
          ? "Nada encontrado com esses filtros."
          : "Nenhuma ação registrada ainda."}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-admin-foreground/55">
        {filtering
          ? "Tente outra busca, outra categoria ou amplie o período."
          : "Assim que alguém mexer em turmas, pessoas ou dinheiro, o registro aparece aqui."}
      </p>
      {filtering && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 rounded-xl border border-admin-border bg-admin-surface px-3 py-2 text-sm font-medium text-admin-foreground transition-colors hover:border-gold-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          Limpar filtros
        </button>
      )}
    </motion.div>
  );
}
