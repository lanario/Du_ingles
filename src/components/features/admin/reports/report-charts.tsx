"use client";

/**
 * Gráficos do relatório financeiro.
 *
 * Mesma divisão de movimento do resto do painel: **Framer Motion** cuida do
 * ciclo de vida do React (entrada das barras, troca de competência, hover) e
 * **GSAP** do que é imperativo e contínuo (traçado da linha de resultado,
 * count-up dos valores). Nenhum nó é animado pelas duas ao mesmo tempo.
 *
 * A paleta de dinheiro (`MONEY`) vem do dashboard de propósito: receita
 * verde, custo profissional vermelho e estrutura laranja são a única
 * convenção que o admin lê sem legenda, e repeti-la aqui mantém o relatório e
 * o painel falando a mesma língua.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  formatNumber,
  useMeasuredWidth,
} from "@/components/features/admin/dashboard/primitives";
import {
  niceCeil,
  prefersReducedMotion,
  smoothPath,
} from "@/components/features/admin/dashboard/charts";
import { MONEY, formatBRL } from "@/components/features/admin/dashboard/finance-charts";
import type { ReportMonthPoint } from "@/repositories/financial-reports";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Régua curta do eixo Y: `R$ 12 mil`, `R$ 1,2 mi`. */
function axisLabel(cents: number): string {
  const reais = cents / 100;
  const abs = Math.abs(reais);
  if (abs >= 1_000_000) return `R$ ${formatNumber(reais / 1_000_000, 1)} mi`;
  if (abs >= 10_000) return `R$ ${formatNumber(reais / 1000, 0)} mil`;
  return `R$ ${formatNumber(reais, 0)}`;
}

/**
 * Valor em reais com count-up após a hidratação.
 *
 * O número final já sai renderizado do servidor e o tween só reescreve o
 * `textContent` — sem flash de "R$ 0" e sem mismatch de hidratação. O tween
 * nasce dentro do `onEnter` (e não como opção do ScrollTrigger) porque, como
 * opção, o GSAP renderiza o frame zero na criação e zera o valor na tela
 * enquanto o card estiver fora da viewport.
 */
export function MoneyValue({
  cents,
  className,
  duration = 1.1,
}: {
  cents: number;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let tween: gsap.core.Tween | null = null;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 96%",
      once: true,
      onEnter: () => {
        const state = { current: 0 };
        tween = gsap.to(state, {
          current: cents,
          duration,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = formatBRL(Math.round(state.current));
          },
        });
      },
    });

    return () => {
      trigger.kill();
      tween?.kill();
      // Interromper no meio do tween deixaria um valor parcial congelado.
      el.textContent = formatBRL(cents);
    };
  }, [cents, duration]);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {formatBRL(cents)}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/*                        Receitas × despesas por mês                        */
/* ------------------------------------------------------------------------ */

const FALLBACK_W = 760;
const WIDE_PAD = { left: 64, right: 20, top: 18, bottom: 34 };
const COMPACT_PAD = { left: 46, right: 12, top: 16, bottom: 28 };

/**
 * As duas colunas lado a lado — receita de um lado, despesa (professores
 * embaixo, estrutura em cima) do outro — mais o fio do resultado por cima.
 *
 * Barras agrupadas e não empilhadas porque a pergunta do mês é "entrou mais
 * do que saiu?": empilhar receita e despesa na mesma coluna esconderia
 * exatamente a comparação que a tela existe para responder. A despesa, essa
 * sim, é empilhada — folha e estrutura somam o mesmo lado da conta.
 */
export function RevenueExpenseChart({
  points,
  height = 268,
}: {
  points: ReportMonthPoint[];
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const lineRef = useRef<SVGPathElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const [wrapRef, W] = useMeasuredWidth(FALLBACK_W);

  // Faixa estreita: o eixo em reais nao cabe nos 64px de gutter e a altura
  // cheia deixaria as barras finas demais. `PAD` precisa ser estavel entre
  // renders — entra nas dependencias de `geo`.
  const compact = W < 520;
  const PAD = useMemo(() => (compact ? COMPACT_PAD : WIDE_PAD), [compact]);
  const chartHeight = compact ? Math.min(height, 220) : height;

  const geo = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = chartHeight - PAD.top - PAD.bottom;

    const maxCents = Math.max(
      1,
      ...points.map((point) => Math.max(point.revenueCents, point.expenseCents)),
    );
    // A régua é calculada em reais para o arredondamento cair em 3/6/9/12 e
    // não em múltiplos de centavo.
    const ceiling = niceCeil(maxCents / 100) * 100;

    const slot = innerW / Math.max(points.length, 1);
    const barW = Math.min(26, slot * 0.3);
    const gap = Math.min(6, slot * 0.06);

    const y = (cents: number) => PAD.top + innerH * (1 - cents / ceiling);
    const centerX = (index: number) => PAD.left + slot * (index + 0.5);

    // O fio do resultado é assinado: precisa de uma régua própria, ancorada
    // no zero, para o mês no vermelho cair abaixo da linha de base.
    const nets = points.map((point) => point.netCents);
    const netMax = Math.max(1, ...nets, 0);
    const netMin = Math.min(0, ...nets);
    const netSpan = netMax - netMin || 1;
    const netY = (cents: number) => PAD.top + innerH * (1 - (cents - netMin) / netSpan);

    const linePoints = points.map((point, index) => ({
      x: centerX(index),
      y: netY(point.netCents),
    }));

    return {
      innerH,
      ceiling,
      slot,
      barW,
      gap,
      y,
      centerX,
      zeroY: netY(0),
      linePath: smoothPath(linePoints),
      linePoints,
      ticks: [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
        cents: ceiling * ratio,
        y: PAD.top + innerH * (1 - ratio),
      })),
    };
  }, [points, W, chartHeight, PAD]);

  useEffect(() => {
    const path = lineRef.current;
    if (!path || prefersReducedMotion()) return;

    const length = path.getTotalLength();
    const tween = gsap.fromTo(
      path,
      { strokeDasharray: length, strokeDashoffset: length },
      {
        strokeDashoffset: 0,
        duration: 1.3,
        ease: "power2.out",
        scrollTrigger: { trigger: path, start: "top 92%", once: true },
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [geo.linePath]);

  const stride = Math.max(1, Math.ceil(points.length / (compact ? 4 : 12)));
  const activeIndex = active;
  const activePoint = activeIndex != null ? points[activeIndex] : null;
  const previousPoint =
    activeIndex != null && activeIndex > 0 ? points[activeIndex - 1] : null;
  // Margem só existe com receita: sem ela o resultado é prejuízo puro, e
  // dividir por zero devolveria "Infinity%" na tela.
  const margin =
    activePoint && activePoint.revenueCents > 0
      ? (100 * activePoint.netCents) / activePoint.revenueCents
      : null;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${chartHeight}`}
        className="w-full"
        style={{ height: chartHeight }}
        role="img"
        aria-label="Receitas e despesas por mês"
        onMouseLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={`rev-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MONEY.revenueSoft} />
            <stop offset="100%" stopColor={MONEY.revenue} />
          </linearGradient>
          <linearGradient id={`cost-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MONEY.costSoft} />
            <stop offset="100%" stopColor={MONEY.cost} />
          </linearGradient>
          <linearGradient id={`exp-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MONEY.expenseSoft} />
            <stop offset="100%" stopColor={MONEY.expense} />
          </linearGradient>
        </defs>

        {/*
          Faixa e guia do mês apontado. Sem elas o balão fala de um mês que o
          olho ainda precisa localizar entre seis colunas parecidas.
        */}
        {activeIndex != null && (
          <g pointerEvents="none">
            <rect
              x={PAD.left + geo.slot * activeIndex}
              y={PAD.top}
              width={geo.slot}
              height={geo.innerH}
              fill={MONEY.ink}
              opacity={0.04}
              rx={6}
            />
            <line
              x1={geo.centerX(activeIndex)}
              x2={geo.centerX(activeIndex)}
              y1={PAD.top}
              y2={PAD.top + geo.innerH}
              stroke={MONEY.ink}
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.25}
            />
          </g>
        )}

        {geo.ticks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={tick.y}
              y2={tick.y}
              stroke={MONEY.grid}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 10}
              y={tick.y + 3.5}
              textAnchor="end"
              fontSize={10}
              fill={MONEY.muted}
            >
              {axisLabel(tick.cents)}
            </text>
          </g>
        ))}

        {points.map((point, index) => {
          const cx = geo.centerX(index);
          const revX = cx - geo.barW - geo.gap / 2;
          const expX = cx + geo.gap / 2;
          const revH = Math.max(
            point.revenueCents > 0 ? 2 : 0,
            geo.y(0) - geo.y(point.revenueCents),
          );
          const costH = Math.max(
            point.professionalCostCents > 0 ? 2 : 0,
            geo.y(0) - geo.y(point.professionalCostCents),
          );
          const opexH = Math.max(
            point.operatingExpenseCents > 0 ? 2 : 0,
            geo.y(0) - geo.y(point.operatingExpenseCents),
          );
          const baseY = geo.y(0);
          const isActive = active === index;

          return (
            <g key={point.key} opacity={active == null || isActive ? 1 : 0.45}>
              <motion.rect
                x={revX}
                width={geo.barW}
                rx={4}
                fill={`url(#rev-${uid})`}
                initial={
                  reduced ? { height: revH, y: baseY - revH } : { height: 0, y: baseY }
                }
                whileInView={{ height: revH, y: baseY - revH }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.7,
                  delay: index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />

              {/* Folha na base, estrutura empilhada por cima. */}
              <motion.rect
                x={expX}
                width={geo.barW}
                rx={4}
                fill={`url(#cost-${uid})`}
                initial={
                  reduced ? { height: costH, y: baseY - costH } : { height: 0, y: baseY }
                }
                whileInView={{ height: costH, y: baseY - costH }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.7,
                  delay: 0.06 + index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
              <motion.rect
                x={expX}
                width={geo.barW}
                rx={4}
                fill={`url(#exp-${uid})`}
                initial={
                  reduced
                    ? { height: opexH, y: baseY - costH - opexH }
                    : { height: 0, y: baseY - costH }
                }
                whileInView={{ height: opexH, y: baseY - costH - opexH }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.7,
                  delay: 0.12 + index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />

              {/* Numa faixa estreita os rotulos de todos os meses colidem;
                  mostra um a cada "stride", mais o mes sob o cursor. */}
              {(index % stride === 0 || isActive) && (
                <text
                  x={cx}
                  y={chartHeight - 12}
                  textAnchor="middle"
                  fontSize={10}
                  fill={isActive ? MONEY.ink : MONEY.muted}
                  fontWeight={isActive ? 600 : 400}
                >
                  {point.label}
                </text>
              )}
            </g>
          );
        })}

        <path
          ref={lineRef}
          d={geo.linePath}
          fill="none"
          stroke={MONEY.ink}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1 0"
          opacity={0.55}
          vectorEffect="non-scaling-stroke"
        />
        {geo.linePoints.map((point, index) => (
          <circle
            key={points[index]?.key}
            cx={point.x}
            cy={point.y}
            r={active === index ? 4.5 : 3}
            fill={(points[index]?.netCents ?? 0) >= 0 ? MONEY.revenue : MONEY.cost}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        ))}

        {/* Faixas invisíveis de captura: um alvo grande por mês. */}
        {points.map((point, index) => (
          <rect
            key={`hit-${point.key}`}
            x={PAD.left + geo.slot * index}
            y={PAD.top}
            width={geo.slot}
            height={geo.innerH}
            fill="transparent"
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            tabIndex={0}
            role="button"
            aria-label={`${point.title}: receita ${formatBRL(point.revenueCents)}, despesa ${formatBRL(point.expenseCents)}`}
            onMouseLeave={() =>
              setActive((current) => (current === index ? null : current))
            }
            onBlur={() => setActive((current) => (current === index ? null : current))}
            className="cursor-pointer focus:outline-none"
          />
        ))}
      </svg>

      <AnimatePresence>
        {activePoint && (
          <motion.div
            key={activePoint.key}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            role="tooltip"
            className="pointer-events-none absolute top-2 z-20 w-[13.5rem] rounded-xl border border-admin-border bg-admin-surface/95 px-3 py-2.5 shadow-[0_10px_30px_-18px_rgba(11,26,51,0.5)] backdrop-blur"
            style={{
              left: `${(geo.centerX(activeIndex ?? 0) / W) * 100}%`,
              // Nas pontas o balão gira para dentro do gráfico; centrado, ele
              // sairia pela borda e ficaria cortado.
              transform: `translateX(${
                activeIndex === 0
                  ? "-8%"
                  : activeIndex === points.length - 1
                    ? "-92%"
                    : "-50%"
              })`,
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold capitalize text-admin-foreground">
                {activePoint.title}
              </p>
              {margin != null && (
                <span
                  className="tabular rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    color: activePoint.netCents >= 0 ? MONEY.revenue : MONEY.cost,
                    backgroundColor: `color-mix(in srgb, ${
                      activePoint.netCents >= 0 ? MONEY.revenue : MONEY.cost
                    } 12%, #ffffff)`,
                  }}
                >
                  {formatNumber(margin, 1)}% margem
                </span>
              )}
            </div>

            <ul className="mt-1.5 space-y-0.5 text-[11px]">
              <TooltipRow
                color={MONEY.revenue}
                label="Receitas"
                cents={activePoint.revenueCents}
              />
              <TooltipRow
                color={MONEY.cost}
                label="Professores"
                cents={activePoint.professionalCostCents}
              />
              <TooltipRow
                color={MONEY.expense}
                label="Estrutura"
                cents={activePoint.operatingExpenseCents}
              />
              <TooltipRow
                color={MONEY.muted}
                label="Despesa total"
                cents={activePoint.expenseCents}
              />
              <TooltipRow
                color={activePoint.netCents >= 0 ? MONEY.revenue : MONEY.cost}
                label="Resultado"
                cents={activePoint.netCents}
                strong
                divided
              />
            </ul>

            {/* Comparação com o mês anterior: é o que transforma um número
                solto em tendência, sem obrigar a percorrer o gráfico. */}
            {previousPoint && (
              <p className="mt-1.5 border-t border-admin-border/70 pt-1.5 text-[10px] text-admin-foreground/50">
                {activePoint.netCents === previousPoint.netCents ? (
                  <>estável em relação a {previousPoint.label}</>
                ) : (
                  <>
                    {activePoint.netCents > previousPoint.netCents ? "▲" : "▼"}{" "}
                    <span className="tabular font-semibold text-admin-foreground/70">
                      {formatBRL(Math.abs(activePoint.netCents - previousPoint.netCents))}
                    </span>{" "}
                    vs. {previousPoint.label}
                  </>
                )}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ChartLegend />
    </div>
  );
}

function TooltipRow({
  color,
  label,
  cents,
  strong,
  divided,
}: {
  color: string;
  label: string;
  cents: number;
  strong?: boolean;
  /** Fecha a conta: separa a linha do bloco de cima. */
  divided?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-4",
        divided && "mt-1 border-t border-admin-border/70 pt-1",
      )}
    >
      <span className="flex items-center gap-1.5 text-admin-foreground/65">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {label}
      </span>
      <span
        className={cn("tabular", strong ? "font-semibold" : "text-admin-foreground/80")}
        style={strong ? { color } : undefined}
      >
        {formatBRL(cents)}
      </span>
    </li>
  );
}

function ChartLegend() {
  const items = [
    { color: MONEY.revenue, label: "Receitas" },
    { color: MONEY.cost, label: "Professores" },
    { color: MONEY.expense, label: "Estrutura" },
    { color: MONEY.ink, label: "Resultado" },
  ];

  return (
    <ul className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-[11px] text-admin-foreground/55"
        >
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------ */
/*                          Cascata do resultado                             */
/* ------------------------------------------------------------------------ */

export interface WaterfallStep {
  label: string;
  cents: number;
  /** `out` desce a coluna; `in` a levanta; `result` fecha a conta. */
  role: "in" | "out" | "result";
}

/**
 * Como a receita vira resultado, passo a passo. Cada coluna começa onde a
 * anterior parou — é a leitura que mostra *qual* linha comeu a margem, coisa
 * que três totais lado a lado não contam.
 */
export function ResultWaterfall({ steps }: { steps: WaterfallStep[] }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  const bars = useMemo(() => {
    let running = 0;
    const computed = steps.map((step) => {
      const start = step.role === "result" ? 0 : running;
      const end =
        step.role === "in"
          ? running + step.cents
          : step.role === "out"
            ? running - step.cents
            : step.cents;
      if (step.role !== "result") running = end;
      return { ...step, start, end };
    });

    const ceiling = Math.max(
      1,
      ...computed.flatMap((bar) => [Math.abs(bar.start), Math.abs(bar.end)]),
    );
    return computed.map((bar) => ({
      ...bar,
      top: Math.max(bar.start, bar.end) / ceiling,
      bottom: Math.min(bar.start, bar.end) / ceiling,
    }));
  }, [steps]);

  const tone = (role: WaterfallStep["role"], cents: number) =>
    role === "in"
      ? MONEY.revenue
      : role === "out"
        ? MONEY.cost
        : cents >= 0
          ? MONEY.revenue
          : MONEY.cost;

  return (
    <div className="flex items-end gap-3" style={{ height: 190 }}>
      {bars.map((bar, index) => {
        const color = tone(bar.role, bar.cents);
        const heightRatio = Math.max(bar.top - Math.max(bar.bottom, 0), 0.012);
        const focused = active === bar.label;

        return (
          <div
            key={bar.label}
            onMouseEnter={() => setActive(bar.label)}
            onMouseLeave={() =>
              setActive((current) => (current === bar.label ? null : current))
            }
            onFocus={() => setActive(bar.label)}
            onBlur={() =>
              setActive((current) => (current === bar.label ? null : current))
            }
            tabIndex={0}
            role="group"
            aria-label={`${bar.label}: ${formatBRL(bar.cents)}`}
            className={cn(
              "relative flex h-full min-w-0 flex-1 flex-col justify-end rounded-lg outline-none transition-opacity",
              "focus-visible:ring-2 focus-visible:ring-gold-500",
              active != null && !focused && "opacity-45",
            )}
          >
            <span
              className="tabular mb-1.5 truncate text-center text-[11px] font-semibold"
              style={{ color }}
            >
              {bar.role === "out" && "−"}
              {formatBRL(Math.abs(bar.cents))}
            </span>

            <AnimatePresence>
              {focused && (
                <motion.div
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  role="tooltip"
                  className={cn(
                    "pointer-events-none absolute bottom-full z-20 mb-2 w-[11.5rem] rounded-xl border border-admin-border bg-admin-surface px-2.5 py-2 shadow-[0_10px_30px_-18px_rgba(11,26,51,0.5)]",
                    index === 0
                      ? "left-0"
                      : index === bars.length - 1
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2",
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-admin-foreground/45">
                    {bar.label}
                  </p>
                  <p className="tabular mt-1 text-sm font-semibold" style={{ color }}>
                    {bar.role === "out" && "−"}
                    {formatBRL(Math.abs(bar.cents))}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-admin-foreground/50">
                    {bar.role === "result" ? (
                      <>o que sobrou depois de todas as saídas</>
                    ) : (
                      <>
                        conta acumulada:{" "}
                        <span className="tabular font-semibold text-admin-foreground/70">
                          {formatBRL(bar.end)}
                        </span>
                      </>
                    )}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative h-full">
              <motion.div
                className="absolute inset-x-0 rounded-md"
                style={{
                  background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 62%, #ffffff))`,
                  bottom: `${Math.max(bar.bottom, 0) * 100}%`,
                }}
                initial={reduced ? false : { height: 0, opacity: 0 }}
                whileInView={{ height: `${heightRatio * 100}%`, opacity: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </div>
            <span className="mt-2 truncate text-center text-[10px] uppercase tracking-[0.1em] text-admin-foreground/45">
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/*                          Ranking com barra                                */
/* ------------------------------------------------------------------------ */

export interface RankRowData {
  id: string;
  label: string;
  sublabel?: string;
  cents: number;
  share: number;
  /** Coluna direita opcional: aulas dadas, nº de lançamentos, status. */
  meta?: string;
  tone?: string;
  /** Parte já liquidada, desenhada em tom cheio dentro da barra. */
  settledShare?: number;
  muted?: boolean;
}

/**
 * Ranking de pessoas (aluno ou professor). A barra carrega duas informações:
 * o comprimento é o peso sobre o total, e o trecho opaco é a parte já
 * liquidada — quem está no topo mas não pagou aparece como barra vazia.
 */
export function RankList({
  rows,
  tone = MONEY.revenue,
}: {
  rows: RankRowData[];
  tone?: string;
}) {
  const reduced = useReducedMotion();
  const ceiling = Math.max(...rows.map((row) => row.cents), 1);

  return (
    <ul className="divide-y divide-admin-border/70">
      {rows.map((row, index) => {
        const color = row.muted ? MONEY.muted : (row.tone ?? tone);
        const width = (row.cents / ceiling) * 100;

        return (
          <motion.li
            key={row.id}
            layout
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.035 }}
            className="group px-1 py-3 transition-colors hover:bg-admin-muted/40"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  className={cn(
                    "truncate text-sm",
                    row.muted
                      ? "text-admin-foreground/55 italic"
                      : "font-medium text-admin-foreground",
                  )}
                >
                  {row.label}
                </span>
                {row.sublabel && (
                  <span className="shrink-0 text-[11px] text-admin-foreground/45">
                    {row.sublabel}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                {row.meta && (
                  <span className="tabular text-[11px] text-admin-foreground/45">
                    {row.meta}
                  </span>
                )}
                <span className="tabular text-sm font-semibold" style={{ color }}>
                  {formatBRL(row.cents)}
                </span>
              </span>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-admin-muted">
                <motion.div
                  className="relative h-full rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${color} 38%, #ffffff)` }}
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: `${Math.max(width, 1.5)}%` }}
                  transition={{
                    duration: 0.75,
                    delay: 0.05 + Math.min(index, 12) * 0.04,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {row.settledShare != null && (
                    <motion.span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ backgroundColor: color }}
                      initial={reduced ? false : { width: 0 }}
                      animate={{ width: `${Math.min(100, row.settledShare * 100)}%` }}
                      transition={{
                        duration: 0.9,
                        delay: 0.25,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />
                  )}
                </motion.div>
              </div>
              <span className="tabular w-10 shrink-0 text-right text-[11px] text-admin-foreground/45">
                {formatNumber(row.share * 100, 1)}%
              </span>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
