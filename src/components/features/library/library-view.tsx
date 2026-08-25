"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  CloseIcon,
  GroupsIcon,
  LibraryIcon,
  SearchIcon,
  SparkleIcon,
} from "@/components/ui/icons";
import { DownloadPdfButton } from "@/components/features/library/download-pdf-button";
import type { LibraryEntry } from "@/repositories/library";

const TZ = "America/Sao_Paulo";
const NEW_FOR_DAYS = 7;

/**
 * Divisão de trabalho entre as duas libs, igual ao resto do painel: GSAP
 * conduz o cabeçalho (linha do tempo imperativa, contadores) e o Framer
 * Motion cuida do ciclo de vida do React — entrada, hover e, principalmente,
 * a reorganização do grid quando o aluno filtra ou busca. Nenhum nó é
 * animado pelas duas ao mesmo tempo.
 */

function formatDate(iso: string, pattern: string) {
  return formatInTimeZone(new Date(iso), TZ, pattern, { locale: ptBR });
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isRecent(iso: string): boolean {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return days >= 0 && days <= NEW_FOR_DAYS;
}

/**
 * Normaliza acento e caixa para que "ingles" encontre "Inglês". `NFD` separa
 * a letra do acento; `\p{Diacritic}` remove só o acento solto que sobrou.
 */
function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------

/** Contador do cabeçalho — tween puro, sem ScrollTrigger: está sempre visível. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const state = { current: 0 };
    const tween = gsap.to(state, {
      current: value,
      duration: 1,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = String(Math.round(state.current));
      },
    });

    return () => {
      tween.kill();
    };
  }, [value]);

  return <span ref={ref}>{value}</span>;
}

function StatCard({
  icon,
  label,
  value,
  caption,
  tone = "navy",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  caption: string;
  tone?: "navy" | "gold";
}) {
  return (
    <div
      data-hero-item
      className="group relative overflow-hidden rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-card)] transition-colors duration-300 hover:border-gold-300"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-gold-100/60 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
          "relative mt-3 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "gold" ? "text-gold-700" : "text-navy-900",
        )}
      >
        {value}
      </p>
      <p className="relative mt-0.5 truncate text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartão de material
// ---------------------------------------------------------------------------

function MaterialCard({ entry }: { entry: LibraryEntry }) {
  const reduced = useReducedMotion();
  const recent = isRecent(entry.scheduledAt);

  return (
    <motion.li
      layout
      initial={reduced ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduced ? undefined : { y: -4 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-background p-5",
        "shadow-[var(--shadow-card)] transition-[box-shadow,border-color] duration-300",
        "hover:border-navy-100 hover:shadow-[var(--shadow-card-hover)]",
      )}
    >
      {/* Lombada dourada: cresce de cima para baixo no hover, como a aba de
          uma pasta sendo puxada da prateleira. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-5 left-0 w-[3px] origin-top scale-y-0 rounded-r-full bg-gradient-to-b from-gold-400 to-gold-500/0 transition-transform duration-500 ease-out group-hover:scale-y-100"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-navy-50 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-navy-800 to-navy-600 text-gold-300 shadow-[0_8px_20px_-12px_rgba(10,31,68,0.9)] transition-transform duration-300 group-hover:scale-105">
          <LibraryIcon className="h-5 w-5" />
        </span>

        <div className="flex flex-none items-center gap-2">
          {recent && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold-300 bg-gold-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-gold-700">
              <SparkleIcon className="h-3 w-3" />
              Novo
            </span>
          )}
          <span className="flex flex-col items-center rounded-lg bg-navy-50 px-2.5 py-1 leading-none text-navy-700">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">
              {formatDate(entry.scheduledAt, "MMM")}
            </span>
            <span className="mt-0.5 text-base font-bold tabular-nums">
              {formatDate(entry.scheduledAt, "dd")}
            </span>
          </span>
        </div>
      </div>

      <h3 className="relative mt-4 text-base font-semibold leading-snug text-navy-900">
        {entry.title}
      </h3>

      <p className="relative mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium text-navy-700">
          <GroupsIcon className="h-3.5 w-3.5 flex-none" />
          <span className="truncate">{entry.groupName}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="h-3.5 w-3.5" />
          {formatDate(entry.scheduledAt, "dd/MM/yyyy")}
        </span>
      </p>

      <div className="relative mt-5 border-t border-border pt-4">
        <DownloadPdfButton sessionId={entry.id} hasPdf={entry.hasPdf} />
      </div>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------
// Estado vazio
// ---------------------------------------------------------------------------

function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center transition-colors duration-300 hover:border-gold-300 hover:bg-gold-50/30"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-700">
        <LibraryIcon className="h-6 w-6" />
      </span>
      <p className="mt-4 font-medium text-navy-900">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      {action}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

export interface LibraryViewProps {
  entries: LibraryEntry[];
  groups: { id: string; name: string }[];
  selectedGroupId?: string;
}

export function LibraryView({ entries, groups, selectedGroupId }: LibraryViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const heroRef = useRef<HTMLDivElement>(null);

  // Entrada do cabeçalho: uma linha do tempo só, escalonando eyebrow, título,
  // subtítulo, régua e cartões de métrica.
  useEffect(() => {
    const root = heroRef.current;
    if (!root || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from("[data-hero-line]", { y: 18, opacity: 0, duration: 0.6, stagger: 0.08 })
        .from(
          "[data-hero-rule]",
          { scaleX: 0, transformOrigin: "left center", duration: 0.7 },
          "-=0.35",
        )
        .from(
          "[data-hero-item]",
          { y: 20, opacity: 0, duration: 0.55, stagger: 0.07 },
          "-=0.45",
        );
    }, root);

    return () => ctx.revert();
  }, []);

  const visible = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return entries;
    return entries.filter(
      (entry) =>
        normalize(entry.title).includes(term) || normalize(entry.groupName).includes(term),
    );
  }, [entries, query]);

  /** Agrupa por mês preservando a ordem (mais recente primeiro) do repositório. */
  const months = useMemo(() => {
    const buckets = new Map<string, { label: string; items: LibraryEntry[] }>();
    for (const entry of visible) {
      const key = formatDate(entry.scheduledAt, "yyyy-MM");
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.items.push(entry);
      } else {
        buckets.set(key, {
          label: formatDate(entry.scheduledAt, "MMMM 'de' yyyy"),
          items: [entry],
        });
      }
    }
    return [...buckets.entries()].map(([key, value]) => ({ key, ...value }));
  }, [visible]);

  const readyCount = entries.filter((entry) => entry.hasPdf).length;
  const groupCount = new Set(entries.map((entry) => entry.groupId)).size;
  const latest = entries[0] ?? null;

  const filters: { id?: string; name: string }[] = [
    { name: "Todas as turmas" },
    ...groups,
  ];

  function selectGroup(groupId?: string) {
    startTransition(() => {
      router.push(groupId ? `/biblioteca?turma=${groupId}` : "/biblioteca");
    });
  }

  return (
    <div className="pb-4">
      {/* -------------------------------------------------------- cabeçalho */}
      <div ref={heroRef}>
        <p
          data-hero-line
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600"
        >
          Área do aluno
        </p>
        <h1
          data-hero-line
          className="mt-1 text-2xl font-semibold tracking-tight text-navy-900 sm:text-3xl"
        >
          Biblioteca
        </h1>
        <p data-hero-line className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Todo o material das aulas já realizadas fica guardado aqui. Baixe o PDF para
          revisar o conteúdo quando quiser — inclusive offline.
        </p>
        <span
          data-hero-rule
          aria-hidden="true"
          className="mt-5 block h-px w-full bg-gradient-to-r from-gold-400 via-navy-100 to-transparent"
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={<LibraryIcon className="h-4 w-4" />}
            label="Materiais"
            value={<CountUp value={entries.length} />}
            caption={
              entries.length > 0 && readyCount === entries.length
                ? "todos prontos para download"
                : `${readyCount} prontos para download`
            }
          />
          <StatCard
            icon={<GroupsIcon className="h-4 w-4" />}
            label="Turmas"
            value={<CountUp value={groupCount} />}
            caption="com material publicado"
          />
          <StatCard
            tone="gold"
            icon={<CalendarIcon className="h-4 w-4" />}
            label="Última aula"
            value={latest ? formatDate(latest.scheduledAt, "dd/MM") : "—"}
            caption={latest ? latest.title : "nenhuma aula publicada ainda"}
          />
        </div>
      </div>

      {/* --------------------------------------------------------- controles */}
      {entries.length > 0 && (
        <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {groups.length > 1 && (
            <div
              role="tablist"
              aria-label="Filtrar por turma"
              className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1"
            >
              {filters.map((filter) => {
                const active = filter.id === selectedGroupId;
                return (
                  <button
                    key={filter.id ?? "all"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectGroup(filter.id)}
                    className={cn(
                      "relative flex-none rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "text-white" : "text-navy-700 hover:bg-navy-50",
                    )}
                  >
                    {/* `layoutId`: a pílula ativa desliza de um filtro ao
                        outro em vez de piscar no destino. */}
                    {active && (
                      <motion.span
                        layoutId="library-filter-pill"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        className="absolute inset-0 rounded-full bg-navy-800"
                      />
                    )}
                    <span className="relative">{filter.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative lg:w-72">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por aula ou turma…"
              aria-label="Buscar material"
              className={cn(
                "h-10 w-full rounded-full border border-border bg-background pl-9 pr-9 text-sm",
                "placeholder:text-muted-foreground",
                "transition-colors focus-visible:border-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-navy-900"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------- lista */}
      <motion.div
        animate={{ opacity: isPending ? 0.55 : 1 }}
        transition={{ duration: 0.2 }}
        className="mt-6"
      >
        {entries.length === 0 ? (
          <EmptyState
            title="Nenhuma aula publicada ainda."
            hint="O material aparece aqui assim que uma aula é encerrada."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={`Nada encontrado para “${query.trim()}”.`}
            hint="Tente outro termo ou volte para a lista completa."
            action={
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-4 rounded-full border border-navy-700 px-4 py-1.5 text-xs font-semibold text-navy-800 transition-colors hover:bg-navy-800 hover:text-white"
              >
                Limpar busca
              </button>
            }
          />
        ) : (
          <div className="space-y-8">
            {months.map((month) => (
              <section key={month.key}>
                {/* Gruda no topo do <main>, que é o container de rolagem —
                    o mês corrente acompanha a leitura da lista. */}
                <div className="sticky top-0 z-10 -mx-1 flex items-center gap-3 bg-background/85 px-1 py-2 backdrop-blur">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-800">
                    {month.label}
                  </h2>
                  <span
                    aria-hidden="true"
                    className="h-px flex-1 bg-gradient-to-r from-gold-300 to-transparent"
                  />
                  <span className="flex-none text-[11px] tabular-nums text-muted-foreground">
                    {month.items.length}{" "}
                    {month.items.length === 1 ? "material" : "materiais"}
                  </span>
                </div>

                <motion.ul layout className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {month.items.map((entry) => (
                      <MaterialCard key={entry.id} entry={entry} />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              </section>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
