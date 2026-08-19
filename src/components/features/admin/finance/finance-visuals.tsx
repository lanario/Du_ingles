"use client";

/**
 * Peças visuais do Financeiro: seletor de competência, cartão de resultado,
 * indicadores, quebra por linha de negócio e os selos de estado.
 *
 * Mesma divisão de movimento do resto do painel: **Framer Motion** cuida do
 * ciclo de vida do React (troca de mês, crescimento das barras, hover) e
 * **GSAP** do que é imperativo e contínuo — aqui, o count-up dos valores, que
 * vem pronto de `dashboard/primitives`. Nenhum nó é animado pelas duas ao
 * mesmo tempo.
 */

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CountUp } from "@/components/features/admin/dashboard/primitives";
import {
  ArrowInIcon,
  ArrowOutIcon,
  ChevronIcon,
  CoinIcon,
  DueDateIcon,
  TrendDownIcon,
  TrendUpIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { FinanceDirection } from "@/schemas/finance";
import type { FinanceTotals, FinanceTrendPoint } from "@/repositories/finance";
import {
  DIRECTION_COPY,
  DIRECTION_TONE,
  STATE_TONE,
  entryState,
  formatMoney,
  monthKeyTitle,
  splitMoney,
  stateLabel,
  type CategorySlice,
  type EntryState,
  type FinanceEntry,
} from "./finance-utils";

// ---------------------------------------------------------------------------
// Competência
// ---------------------------------------------------------------------------

interface MonthPickerProps {
  monthKey: string;
  previousKey: string;
  nextKey: string;
  currentKey: string;
  onChange: (key: string) => void;
  pending: boolean;
}

/**
 * Navegador de mês. O rótulo entra e sai na direção da seta clicada — é o
 * detalhe que faz "voltar um mês" parecer voltar, e não simplesmente trocar
 * de texto.
 */
export function MonthPicker({
  monthKey,
  previousKey,
  nextKey,
  currentKey,
  onChange,
  pending,
}: MonthPickerProps) {
  const reduceMotion = useReducedMotion();
  const directionRef = useRef(1);
  const isCurrent = monthKey === currentKey;

  function go(key: string, direction: 1 | -1) {
    directionRef.current = direction;
    onChange(key);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1">
        <IconButton
          label="Mês anterior"
          onClick={() => go(previousKey, -1)}
          disabled={pending}
        >
          <ChevronIcon className="h-4 w-4 rotate-90" />
        </IconButton>

        <div className="relative flex h-9 min-w-[8.5rem] items-center justify-center overflow-hidden px-2 sm:min-w-[10.5rem]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={monthKey}
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 14 * directionRef.current }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -14 * directionRef.current }
              }
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2 text-sm font-semibold text-admin-foreground"
            >
              <DueDateIcon className="h-4 w-4 text-gold-600" />
              {monthKeyTitle(monthKey)}
            </motion.span>
          </AnimatePresence>
        </div>

        <IconButton label="Próximo mês" onClick={() => go(nextKey, 1)} disabled={pending}>
          <ChevronIcon className="h-4 w-4 -rotate-90" />
        </IconButton>
      </div>

      <AnimatePresence>
        {!isCurrent && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => go(currentKey, currentKey > monthKey ? 1 : -1)}
            className="rounded-xl border border-admin-border bg-admin-surface px-3 py-2 text-xs font-semibold text-admin-foreground/70 transition-colors hover:border-gold-300 hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            Mês atual
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-lg p-2 text-admin-foreground/50 transition-colors hover:bg-admin-muted hover:text-admin-foreground disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Resultado do mês
// ---------------------------------------------------------------------------

/**
 * Cartão-âncora da tela. Mostra o resultado do mês (previsto, não caixa) com
 * as duas barras na mesma régua — é a comparação que responde "sobrou ou
 * faltou" antes de qualquer leitura de número.
 */
export function ResultCard({
  monthKey,
  totals,
  trend,
  onSelectMonth,
}: {
  monthKey: string;
  totals: FinanceTotals;
  trend: FinanceTrendPoint[];
  /** Clique numa coluna da tendência abre aquela competência. */
  onSelectMonth?: (key: string) => void;
}) {
  const positive = totals.netCents >= 0;
  const scale = Math.max(totals.revenueCents, totals.expenseCents, 1);
  const { whole, fraction } = splitMoney(totals.netCents);

  return (
    <motion.section
      layout
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border p-4 sm:p-5 lg:p-6",
        "bg-admin-surface shadow-[0_1px_2px_rgba(11,26,51,0.04),0_16px_40px_-28px_rgba(11,26,51,0.45)]",
        positive ? "border-admin-border" : "border-destructive/30",
      )}
    >
      <span
        aria-hidden
        style={{
          ["--tone" as string]: positive ? "var(--gold-500)" : "var(--destructive)",
        }}
        className="tone-glow pointer-events-none absolute inset-0 opacity-70"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-admin-foreground/45">
            Resultado de {monthKeyTitle(monthKey).toLowerCase()}
          </p>
          <p
            className="mt-1.5 flex flex-wrap items-baseline gap-1.5 text-3xl font-semibold leading-none tabular sm:text-4xl lg:text-[2.75rem]"
            style={{ color: positive ? "var(--navy-900)" : "var(--destructive)" }}
            title={`R$ ${whole},${fraction}`}
          >
            <span className="text-base font-medium text-admin-foreground/45 sm:text-lg">
              R$
            </span>
            <CountUp value={totals.netCents / 100} decimals={2} />
          </p>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
          )}
        >
          {positive ? (
            <TrendUpIcon className="h-3.5 w-3.5" />
          ) : (
            <TrendDownIcon className="h-3.5 w-3.5" />
          )}
          {positive ? "No azul" : "No vermelho"}
        </span>
      </div>

      <div className="relative mt-5 space-y-3.5 sm:mt-6 sm:space-y-4">
        <ScaleBar
          label="Receitas"
          cents={totals.revenueCents}
          settledCents={totals.revenuePaidCents}
          openCents={totals.revenueOpenCents}
          share={totals.revenueCents / scale}
          tone={DIRECTION_TONE.in}
        />
        <ScaleBar
          label="Despesas"
          cents={totals.expenseCents}
          settledCents={totals.expensePaidCents}
          openCents={totals.expenseOpenCents}
          share={totals.expenseCents / scale}
          tone={DIRECTION_TONE.out}
        />
      </div>

      {trend.length > 1 && (
        <div className="mt-auto">
          <TrendBars points={trend} onSelectMonth={onSelectMonth} />
        </div>
      )}
    </motion.section>
  );
}

/**
 * Uma das duas barras da régua do mês. O hover abre a decomposição do valor —
 * quanto já foi liquidado e quanto continua em aberto —, que é a pergunta
 * seguinte de quem acabou de comparar receita com despesa.
 */
function ScaleBar({
  label,
  cents,
  settledCents,
  openCents,
  share,
  tone,
}: {
  label: string;
  cents: number;
  settledCents: number;
  openCents: number;
  share: number;
  tone: string;
}) {
  const reduceMotion = useReducedMotion();
  const [hover, setHover] = useState(false);
  const settledShare = cents > 0 ? settledCents / cents : 0;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      tabIndex={0}
      role="group"
      aria-label={`${label}: ${formatMoney(cents)}`}
      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
    >
      <div className="flex items-baseline justify-between gap-3 text-xs sm:text-[13px]">
        <span className="font-medium text-admin-foreground/70">{label}</span>
        <span className="tabular text-admin-foreground/60">{formatMoney(cents)}</span>
      </div>

      <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-admin-muted">
        <motion.span
          className="relative block h-full rounded-full"
          style={{ backgroundColor: tone, transformOrigin: "left center" }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: Math.max(share, cents > 0 ? 0.02 : 0) }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span aria-hidden className="progress-shimmer absolute inset-0 block" />
          {/* Marca de onde termina o liquidado dentro do previsto. */}
          {cents > 0 && settledShare > 0 && settledShare < 1 && (
            <span
              aria-hidden
              className="absolute inset-y-0 w-px bg-white/70"
              style={{ left: `${settledShare * 100}%` }}
            />
          )}
        </motion.span>
      </div>

      <AnimatePresence initial={false}>
        {hover && cents > 0 && (
          <motion.p
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden text-[11px] text-admin-foreground/50"
          >
            <span className="mt-1 inline-flex flex-wrap gap-x-3 gap-y-0.5">
              <span>
                liquidado{" "}
                <strong className="font-semibold tabular text-admin-foreground/70">
                  {formatMoney(settledCents)}
                </strong>{" "}
                ({Math.round(settledShare * 100)}%)
              </span>
              <span>
                em aberto{" "}
                <strong className="font-semibold tabular text-admin-foreground/70">
                  {formatMoney(openCents)}
                </strong>
              </span>
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Resultado dos últimos meses, em colunas.
 *
 * A primeira versão era um fio contínuo esticado na largura do cartão: com
 * meses zerados (o caso de qualquer escola que começou a lançar agora) ele
 * virava um traço reto sobre a linha do zero, indistinguível de bug. Colunas
 * resolvem isso — mês sem movimento fica visivelmente vazio, e cada barra
 * carrega o próprio rótulo.
 *
 * Cada coluna é um botão: o hover (ou o foco pelo teclado) abre o balão com
 * receita, despesa e resultado do mês, e o clique navega para aquela
 * competência. Um gráfico de seis barras sem os números por trás obriga a
 * conferir mês a mês na seta do topo; com o balão, a comparação acontece na
 * própria faixa.
 *
 * O eixo é simétrico quando há prejuízo em algum mês: a linha do zero vai
 * para o meio e a barra cresce para baixo. Sem prejuízo, tudo cresce do chão,
 * aproveitando a altura inteira.
 */
function TrendBars({
  points,
  onSelectMonth,
}: {
  points: FinanceTrendPoint[];
  onSelectMonth?: (key: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);

  const { hasLoss, peak } = useMemo(() => {
    const values = points.map((point) => point.netCents);
    return {
      hasLoss: values.some((value) => value < 0),
      // `|| 1` evita divisão por zero num histórico inteiramente zerado.
      peak: Math.max(...values.map(Math.abs), 1),
    };
  }, [points]);

  const best = Math.max(...points.map((point) => point.netCents));
  const hovered = active === null ? null : points[active];

  return (
    <div className="relative mt-5 border-t border-admin-border/70 pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-admin-foreground/40">
          Resultado dos últimos {points.length} meses
        </p>
        {/*
          O mesmo dado do balão também vive aqui: em tela sensível ao toque
          não há hover, e o rodapé continua respondendo qual mês foi o melhor.
        */}
        <p className="hidden text-[10px] text-admin-foreground/40 sm:block">
          {hovered ? (
            <span className="capitalize text-admin-foreground/60">
              {hovered.label} · {formatMoney(hovered.netCents)}
            </span>
          ) : (
            <>melhor mês: {formatMoney(best)}</>
          )}
        </p>
      </div>

      <ul className="relative mt-3 flex items-end gap-1.5 sm:gap-2.5">
        {points.map((point, index) => {
          const positive = point.netCents >= 0;
          const share = Math.abs(point.netCents) / peak;
          const last = index === points.length - 1;
          const focused = active === index;
          const tone = positive ? "var(--success)" : "var(--destructive)";

          return (
            <li key={point.key} className="relative min-w-0 flex-1">
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() =>
                  setActive((current) => (current === index ? null : current))
                }
                onFocus={() => setActive(index)}
                onBlur={() =>
                  setActive((current) => (current === index ? null : current))
                }
                onClick={() => onSelectMonth?.(point.key)}
                aria-label={`${point.label}: resultado de ${formatMoney(point.netCents)}. Ver a competência.`}
                className="block w-full cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                <span className="relative block h-16 sm:h-20">
                  {/* Linha do zero: no meio quando há prejuízo, no chão quando não há. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 border-t border-dashed border-admin-border"
                    style={{ top: hasLoss ? "50%" : "100%" }}
                  />

                  {/* Alvo de hover da coluna inteira — barras curtas seriam
                      difíceis de acertar com o ponteiro. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 inset-y-[-4px] rounded-md transition-colors",
                      focused ? "bg-admin-muted/70" : "bg-transparent",
                    )}
                  />

                  <motion.span
                    aria-hidden
                    className="absolute inset-x-0 rounded-[3px]"
                    style={{
                      backgroundColor: tone,
                      transformOrigin: positive ? "bottom center" : "top center",
                      // Metade da altura quando o eixo é simétrico; a altura
                      // toda quando todas as barras crescem do chão.
                      height: hasLoss ? "50%" : "100%",
                      ...(positive ? { bottom: hasLoss ? "50%" : 0 } : { top: "50%" }),
                    }}
                    initial={reduceMotion ? false : { scaleY: 0 }}
                    animate={{
                      scaleY: Math.max(share, point.netCents === 0 ? 0 : 0.04),
                      opacity: focused ? 1 : last ? 0.92 : 0.5,
                    }}
                    transition={{
                      scaleY: {
                        duration: 0.55,
                        delay: 0.05 + index * 0.06,
                        ease: [0.22, 1, 0.36, 1],
                      },
                      opacity: { duration: 0.18 },
                    }}
                  />

                  {point.netCents === 0 && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-admin-muted"
                      style={hasLoss ? { bottom: "50%" } : undefined}
                    />
                  )}
                </span>

                <span
                  className={cn(
                    "mt-1.5 block truncate text-center text-[10px] capitalize transition-colors",
                    focused || last
                      ? "font-semibold text-admin-foreground/70"
                      : "text-admin-foreground/40",
                  )}
                >
                  {point.label}
                </span>
              </button>

              <AnimatePresence>
                {focused && (
                  <motion.div
                    initial={
                      reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }
                    }
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute bottom-full z-20 mb-2 w-[10.5rem] rounded-xl border border-admin-border bg-admin-surface p-2.5 shadow-[0_8px_30px_-12px_rgba(11,26,51,0.45)]",
                      // Nas pontas o balão encosta na borda em vez de sair do
                      // cartão, que tem `overflow-hidden`.
                      index === 0
                        ? "left-0"
                        : index === points.length - 1
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-admin-foreground/45">
                      {monthKeyTitle(point.key)}
                    </p>
                    <dl className="mt-1.5 space-y-1 text-[11px]">
                      <TooltipRow
                        label="Receitas"
                        value={formatMoney(point.revenueCents)}
                        tone={DIRECTION_TONE.in}
                      />
                      <TooltipRow
                        label="Despesas"
                        value={formatMoney(point.expenseCents)}
                        tone={DIRECTION_TONE.out}
                      />
                      <div className="flex items-baseline justify-between gap-2 border-t border-admin-border/70 pt-1">
                        <dt className="font-medium text-admin-foreground/60">
                          Resultado
                        </dt>
                        <dd
                          className="font-semibold tabular"
                          style={{
                            color:
                              point.netCents >= 0
                                ? "var(--success)"
                                : "var(--destructive)",
                          }}
                        >
                          {formatMoney(point.netCents)}
                        </dd>
                      </div>
                    </dl>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-admin-foreground/55">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: tone }}
        />
        {label}
      </dt>
      <dd className="tabular text-admin-foreground/75">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

/**
 * Os dois cartões que também são abas: clicar em "Receitas" filtra a lista.
 * Repetir a informação como controle economiza um clique na barra abaixo, que
 * é o gesto mais comum depois de ler o resultado.
 */
export function DirectionTile({
  direction,
  cents,
  count,
  active,
  onSelect,
}: {
  direction: FinanceDirection;
  cents: number;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const tone = DIRECTION_TONE[direction];
  const Icon = direction === "in" ? ArrowInIcon : ArrowOutIcon;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left transition-colors",
        "bg-admin-surface shadow-[0_1px_2px_rgba(11,26,51,0.04),0_10px_30px_-22px_rgba(11,26,51,0.4)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        active ? "border-transparent" : "border-admin-border hover:border-gold-300",
      )}
      style={active ? { boxShadow: `inset 0 0 0 1.5px ${tone}` } : undefined}
    >
      <span
        aria-hidden
        style={{ ["--tone" as string]: tone }}
        className="tone-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <span
        aria-hidden
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`,
          color: tone,
        }}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-admin-foreground/45">
          {DIRECTION_COPY[direction].tab}
        </span>
        <span
          className="block truncate text-lg font-semibold leading-tight tabular"
          style={{ color: tone }}
        >
          <CountUp value={cents / 100} prefix="R$ " decimals={2} />
        </span>
      </span>

      <span className="relative shrink-0 rounded-full bg-admin-muted px-2 py-0.5 text-[11px] font-semibold tabular text-admin-foreground/55">
        {count}
        <span className="sr-only"> lançamento{count === 1 ? "" : "s"}</span>
      </span>
    </motion.button>
  );
}

/** Indicador simples do trio previsto / liquidado / em aberto. */
export function StatTile({
  label,
  cents,
  tone,
  icon,
  footnote,
  delay = 0,
}: {
  label: string;
  cents: number;
  tone: string;
  icon: "coin" | "wallet" | "due";
  footnote?: React.ReactNode;
  delay?: number;
}) {
  const Icon = icon === "coin" ? CoinIcon : icon === "wallet" ? WalletIcon : DueDateIcon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-admin-border bg-admin-surface p-4"
    >
      <span
        aria-hidden
        className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`,
          color: tone,
        }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.14em] text-admin-foreground/45">
        {label}
      </p>
      <p
        className="mt-1 text-lg font-semibold leading-tight tabular"
        style={{ color: tone }}
      >
        <CountUp value={cents / 100} prefix="R$ " decimals={2} />
      </p>
      {footnote && <div className="mt-1.5 text-[11px]">{footnote}</div>}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Linha de negócio
// ---------------------------------------------------------------------------

/** Fundo translúcido no tom do dado, como nos demais selos da tela. */
function tint(tone: string): string {
  return `color-mix(in srgb, ${tone} 12%, #ffffff)`;
}

export function CategoryBreakdown({
  slices,
  tone,
  title,
  subtitle,
}: {
  slices: CategorySlice[];
  tone: string;
  title: string;
  subtitle: string;
}) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-admin-border bg-admin-surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-admin-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-admin-foreground/55">{subtitle}</p>
        </div>
        <span className="text-[11px] text-admin-foreground/40">
          {slices.length} {slices.length === 1 ? "categoria" : "categorias"}
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
          {slices.map((slice, index) => (
            <motion.li
              key={slice.id}
              layout
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: index * 0.04 }}
              onMouseEnter={() => setHovered(slice.id)}
              onMouseLeave={() =>
                setHovered((current) => (current === slice.id ? null : current))
              }
              onFocus={() => setHovered(slice.id)}
              onBlur={() =>
                setHovered((current) => (current === slice.id ? null : current))
              }
              tabIndex={0}
              className={cn(
                "-mx-2 rounded-lg px-2 py-1 outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-gold-500",
                hovered === slice.id && "bg-admin-muted/60",
              )}
            >
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-medium text-admin-foreground/75">
                  {slice.label}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  {/*
                    A porcentagem só aparece sob o ponteiro: fixa, ela competiria
                    com o valor em reais, que é o número procurado primeiro.
                  */}
                  <AnimatePresence initial={false}>
                    {hovered === slice.id && (
                      <motion.span
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 6 }}
                        transition={{ duration: 0.16 }}
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular"
                        style={{
                          color: tone,
                          backgroundColor: tint(tone),
                        }}
                      >
                        {Math.round(slice.share * 100)}% · {slice.count} lanç.
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="tabular text-admin-foreground/60">
                    {formatMoney(slice.cents)}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-admin-muted">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ backgroundColor: tone, transformOrigin: "left center" }}
                  initial={reduceMotion ? false : { scaleX: 0, opacity: 1 }}
                  animate={{
                    scaleX: Math.max(slice.share, 0.015),
                    // O degradê de opacidade ordena a lista; o item sob o
                    // ponteiro sobe para 100% e sai do fundo.
                    opacity: hovered === slice.id ? 1 : 1 - Math.min(index, 4) * 0.13,
                  }}
                  transition={{
                    scaleX: {
                      duration: 0.6,
                      delay: 0.05 + index * 0.05,
                      ease: [0.22, 1, 0.36, 1],
                    },
                    opacity: { duration: 0.18 },
                  }}
                />
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Selos
// ---------------------------------------------------------------------------

export function StatePill({
  entry,
  today,
  className,
}: {
  entry: FinanceEntry;
  today: string;
  className?: string;
}) {
  const state: EntryState = entryState(entry, today);
  const tone = STATE_TONE[state];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        className,
      )}
      style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 11%, #ffffff)` }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: tone }}
      />
      {stateLabel(state, entry.direction)}
    </span>
  );
}
