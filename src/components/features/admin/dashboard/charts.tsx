"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChartTooltip, formatNumber, useMeasuredWidth } from "./primitives";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * SVG não resolve `var(--token)` quando a cor vem por *atributo* de
 * apresentação (`stroke="…"`, `stop-color="…"`), só quando vem por CSS.
 * Como os gradientes precisam do atributo, a paleta dos gráficos é
 * espelhada aqui em hex — manter em sincronia com `globals.css`.
 */
export const PALETTE = {
  navy: "#0f2c5c",
  navyMid: "#2a63b8",
  navySoft: "#7fa3d8",
  gold: "#c9a227",
  goldSoft: "#d9b45b",
  goldPale: "#e7cd8c",
  ink: "#0b1a33",
  grid: "#e3e9f3",
  muted: "#5a6b85",
} as const;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Teto "redondo" do eixo Y, para a régua não terminar em 37. */
export function niceCeil(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Spline de Catmull-Rom convertida em curvas de Bézier cúbicas. Linha reta
 * em série mensal esconde tendência; a curva suave lê melhor sem distorcer
 * os pontos (todos continuam exatamente sobre a curva).
 */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  }

  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export interface ChartSeries {
  label: string;
  color: string;
  /** Preenche a área sob a linha. Só a série principal deve usar. */
  filled?: boolean;
}

interface AreaChartProps {
  data: { label: string; values: number[] }[];
  series: ChartSeries[];
  height?: number;
  valueSuffix?: string;
}

const CHART_FALLBACK_WIDTH = 760;
const PAD = { left: 40, right: 16, top: 18, bottom: 30 };

/**
 * Série temporal multi-linha com crosshair. O traçado é desenhado pelo GSAP
 * (stroke-dashoffset) ao entrar na viewport; o crosshair é estado de React,
 * porque depende de evento de ponteiro e precisa re-renderizar o tooltip.
 */
export function AreaChart({
  data,
  series,
  height = 260,
  valueSuffix = "",
}: AreaChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [wrapRef, chartWidth] = useMeasuredWidth(CHART_FALLBACK_WIDTH);

  // Card estreito: menos gutter e menos altura, senão a área util do grafico
  // some entre os eixos. `pad` precisa ser estavel entre renders (entra nas
  // deps de `geometry`, que recria os tweens do GSAP).
  const compact = chartWidth < 520;
  const pad = useMemo(() => (compact ? { ...PAD, left: 32, bottom: 26 } : PAD), [compact]);
  const chartHeight = compact ? Math.min(height, 210) : height;

  const geometry = useMemo(() => {
    const innerW = chartWidth - pad.left - pad.right;
    const innerH = chartHeight - pad.top - pad.bottom;
    const max = niceCeil(
      Math.max(1, ...data.flatMap((point) => point.values.map((v) => v || 0))),
    );
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const x = (index: number) => pad.left + index * stepX;
    const y = (value: number) => pad.top + innerH * (1 - value / max);

    const lines = series.map((_, seriesIndex) => {
      const points = data.map((point, index) => ({
        x: x(index),
        y: y(point.values[seriesIndex] ?? 0),
      }));
      const line = smoothPath(points);
      const area = `${line} L${x(data.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`;
      return { points, line, area };
    });

    return { innerH, max, x, y, lines, baseline: pad.top + innerH };
  }, [data, series, chartWidth, chartHeight, pad]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const strokes = svg.querySelectorAll<SVGPathElement>("[data-chart-line]");
      strokes.forEach((path, index) => {
        const length = path.getTotalLength();
        gsap.fromTo(
          path,
          { strokeDasharray: length, strokeDashoffset: length },
          {
            strokeDashoffset: 0,
            duration: 1.6,
            delay: index * 0.12,
            ease: "power2.inOut",
            scrollTrigger: { trigger: svg, start: "top 88%", once: true },
            onComplete: () => {
              // Solta o dash para o crosshair não "cortar" a linha depois.
              path.style.strokeDasharray = "none";
            },
          },
        );
      });

      gsap.from(svg.querySelectorAll("[data-chart-area]"), {
        opacity: 0,
        duration: 1.2,
        delay: 0.35,
        ease: "power1.out",
        scrollTrigger: { trigger: svg, start: "top 88%", once: true },
      });
    }, svg);

    return () => ctx.revert();
  }, [geometry]);

  function handlePointer(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || data.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / chartWidth;
    const localX = (event.clientX - rect.left) / scale;
    const innerW = chartWidth - pad.left - pad.right;
    const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
    const index = Math.round((localX - pad.left) / step);
    setActive(Math.min(data.length - 1, Math.max(0, index)));
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const activePoint = active !== null ? data[active] : null;

  // Cabem ~7 rótulos numa faixa larga e ~4 numa estreita; acima disso eles se
  // sobrepõem. O ponto sob o crosshair aparece independente do salto.
  const stride = Math.max(1, Math.ceil(data.length / (compact ? 4 : 7)));
  const lastIndex = data.length - 1;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Série mensal: ${series.map((s) => s.label).join(", ")}`}
        onPointerMove={handlePointer}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          {series.map((s, index) => (
            <linearGradient
              key={s.label}
              id={`${gradientId}-fill-${index}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {gridLines.map((ratio) => {
          const y = pad.top + geometry.innerH * ratio;
          const value = geometry.max * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={pad.left}
                x2={chartWidth - pad.right}
                y1={y}
                y2={y}
                stroke={PALETTE.grid}
                strokeWidth={1}
                strokeDasharray={ratio === 1 ? "0" : "3 5"}
              />
              <text
                x={pad.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill={PALETTE.muted}
              >
                {formatNumber(Math.round(value))}
              </text>
            </g>
          );
        })}

        {series.map((s, index) =>
          s.filled ? (
            <path
              key={`area-${s.label}`}
              data-chart-area
              d={geometry.lines[index]!.area}
              fill={`url(#${gradientId}-fill-${index})`}
            />
          ) : null,
        )}

        {series.map((s, index) => (
          <path
            key={`line-${s.label}`}
            data-chart-line
            d={geometry.lines[index]!.line}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {active !== null && (
          <g pointerEvents="none">
            <line
              x1={geometry.x(active)}
              x2={geometry.x(active)}
              y1={pad.top}
              y2={geometry.baseline}
              stroke={PALETTE.gold}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {series.map((s, index) => (
              <circle
                key={`dot-${s.label}`}
                cx={geometry.x(active)}
                cy={geometry.y(data[active]!.values[index] ?? 0)}
                r={4.5}
                fill="#ffffff"
                stroke={s.color}
                strokeWidth={2.5}
              />
            ))}
          </g>
        )}

        {data.map((point, index) =>
          index % stride === 0 || index === active ? (
            <text
              key={point.label + index}
              x={geometry.x(index)}
              y={chartHeight - 8}
              textAnchor={
                index === 0 ? "start" : index === lastIndex ? "end" : "middle"
              }
              fontSize="11"
              fill={active === index ? PALETTE.ink : PALETTE.muted}
              fontWeight={active === index ? 600 : 400}
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>

      {activePoint && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-36 -translate-x-1/2 rounded-lg border border-admin-border bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
          style={{
            left: `${((geometry.x(active!) / chartWidth) * 100).toFixed(2)}%`,
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-admin-foreground/60">
            {activePoint.label}
          </p>
          <ul className="mt-1 space-y-0.5">
            {series.map((s, index) => (
              <li
                key={s.label}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="flex items-center gap-1.5 text-admin-foreground/70">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </span>
                <span className="tabular font-semibold text-admin-foreground">
                  {formatNumber(activePoint.values[index] ?? 0)}
                  {valueSuffix}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {series.map((s) => (
        <li
          key={s.label}
          className="group/legend flex cursor-default items-center gap-1.5 text-xs text-admin-foreground/65 transition-colors duration-300 hover:text-admin-foreground"
        >
          <span
            className="h-2 w-2 rounded-full transition-transform duration-300 ease-out group-hover/legend:scale-150"
            style={{ backgroundColor: s.color }}
            aria-hidden
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Anel com crescimento animado por `stroke-dashoffset` (o padrão do dash
 * fica ancorado no início do arco, então o traço "cresce" em vez de
 * deslizar). Cada fatia é um círculo próprio rotacionado no ângulo inicial.
 */
export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  size = 200,
}: {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = 74;
  const circumference = 2 * Math.PI * radius;

  const arcs = useMemo(() => {
    let offsetAngle = 0;
    return slices.map((slice) => {
      const ratio = total > 0 ? slice.value / total : 0;
      const arc = { ...slice, ratio, length: ratio * circumference, offsetAngle };
      offsetAngle += ratio * 360;
      return arc;
    });
  }, [slices, total, circumference]);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const paths = svg.querySelectorAll<SVGCircleElement>("[data-donut-arc]");
      paths.forEach((path, index) => {
        const length = Number(path.dataset.length ?? 0);
        gsap.fromTo(
          path,
          { strokeDashoffset: length },
          {
            strokeDashoffset: 0,
            duration: 1,
            delay: index * 0.08,
            ease: "power2.out",
            scrollTrigger: { trigger: svg, start: "top 90%", once: true },
          },
        );
      });
    }, svg);

    return () => ctx.revert();
  }, [arcs]);

  const activeSlice = active ? (slices.find((s) => s.label === active) ?? null) : null;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <svg
          ref={ref}
          viewBox="0 0 200 200"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={`Distribuição: ${slices.map((s) => `${s.label} ${s.value}`).join(", ")}`}
        >
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={PALETTE.grid}
            strokeWidth={20}
          />
          {arcs.map((arc) =>
            arc.length > 0 ? (
              <circle
                key={arc.label}
                data-donut-arc
                data-length={arc.length}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={active === arc.label ? 26 : 20}
                strokeLinecap="butt"
                strokeDasharray={`${arc.length} ${circumference}`}
                transform={`rotate(${arc.offsetAngle} 100 100)`}
                opacity={active && active !== arc.label ? 0.35 : 1}
                className="cursor-default transition-[opacity,stroke-width] duration-200"
                onPointerEnter={() => setActive(arc.label)}
                onPointerLeave={() => setActive(null)}
              />
            ) : null,
          )}
        </svg>
        {/* O centro conta a fatia sob o ponteiro; sem hover, volta ao total. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          {activeSlice ? (
            <>
              <span className="tabular text-2xl font-semibold text-admin-foreground">
                {formatNumber(activeSlice.value)}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-admin-foreground/50">
                {activeSlice.label}
              </span>
              <span className="tabular mt-0.5 text-[11px] font-medium text-gold-700">
                {total > 0 ? formatNumber((100 * activeSlice.value) / total, 1) : "0"}% do
                total
              </span>
            </>
          ) : (
            <>
              <span className="tabular text-2xl font-semibold text-admin-foreground">
                {centerValue}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-admin-foreground/50">
                {centerLabel}
              </span>
            </>
          )}
        </div>
      </div>

      <ul className="w-full flex-1 space-y-0.5" onPointerLeave={() => setActive(null)}>
        {slices.map((slice) => {
          const isActive = active === slice.label;
          return (
            <li
              key={slice.label}
              className={cn(
                "-mx-2 flex cursor-default items-center gap-2 rounded-lg px-2 py-1 text-sm",
                "transition-[background-color,opacity] duration-200",
                isActive && "bg-navy-50/60",
                active && !isActive && "opacity-45",
              )}
              onPointerEnter={() => setActive(slice.label)}
              onFocus={() => setActive(slice.label)}
              onBlur={() => setActive(null)}
              tabIndex={0}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 flex-none rounded-sm transition-transform duration-200 ease-out",
                  isActive && "scale-150",
                )}
                style={{ backgroundColor: slice.color }}
                aria-hidden
              />
              <span
                className={cn(
                  "flex-1 truncate transition-colors duration-200",
                  isActive ? "text-admin-foreground" : "text-admin-foreground/75",
                )}
              >
                {slice.label}
              </span>
              <span className="tabular font-medium text-admin-foreground">
                {formatNumber(slice.value)}
              </span>
              <span
                className={cn(
                  "tabular w-12 text-right text-xs transition-colors duration-200",
                  isActive ? "text-gold-700" : "text-admin-foreground/45",
                )}
              >
                {total > 0 ? formatNumber((100 * slice.value) / total, 0) : 0}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface BarRow {
  label: string;
  sublabel?: string;
  value: number;
  /** Valor exibido à direita, quando diferente de `value`. */
  display?: string;
  color?: string;
  /** Linha extra revelada quando o ponteiro está sobre a linha. */
  detail?: string;
}

/**
 * Ranking horizontal — a largura anima com Framer Motion ao entrar na tela.
 *
 * No hover a linha sob o ponteiro ganha foco (as demais recuam), o valor
 * bruto aparece ao lado do exibido e a linha de detalhe abre em altura
 * animada (grid 0fr→1fr, sem precisar medir o conteúdo).
 */
export function BarList({
  rows,
  max,
  suffix = "",
  valueLabel = "",
}: {
  rows: BarRow[];
  max?: number;
  suffix?: string;
  /** Sufixo do valor bruto mostrado no hover (ex.: "% de ocupação"). */
  valueLabel?: string;
}) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const ceiling = Math.max(1, max ?? Math.max(...rows.map((r) => r.value), 1));

  return (
    <ul className="space-y-1" onPointerLeave={() => setActive(null)}>
      {rows.map((row, index) => {
        const isActive = active === index;
        const dimmed = active !== null && !isActive;

        return (
          <li
            key={row.label + index}
            className={cn(
              "-mx-2 rounded-lg px-2 py-1.5 transition-[background-color,opacity] duration-200",
              isActive && "bg-navy-50/60",
              dimmed && "opacity-45",
            )}
            onPointerEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            tabIndex={0}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-admin-foreground/85">
                {row.label}
                {row.sublabel && (
                  <span className="ml-2 text-xs text-admin-foreground/45">
                    {row.sublabel}
                  </span>
                )}
              </span>
              <span className="tabular flex flex-none items-baseline gap-2 text-sm font-semibold text-admin-foreground">
                {isActive && (
                  <span className="text-xs font-normal text-admin-foreground/55">
                    {formatNumber(row.value, row.value % 1 === 0 ? 0 : 1)}
                    {suffix}
                    {valueLabel && ` ${valueLabel}`}
                  </span>
                )}
                {row.display ?? `${formatNumber(row.value)}${suffix}`}
              </span>
            </div>
            <div
              className={cn(
                "overflow-hidden rounded-full bg-admin-muted transition-[height] duration-200",
                isActive ? "h-2.5" : "h-2",
              )}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: row.color
                    ? row.color
                    : `linear-gradient(90deg, ${PALETTE.navy}, ${PALETTE.navyMid})`,
                }}
                initial={reduced ? false : { width: 0 }}
                whileInView={{ width: `${Math.min(100, (100 * row.value) / ceiling)}%` }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.9,
                  delay: index * 0.06,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </div>

            {row.detail && (
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isActive ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <p
                  className={cn(
                    "overflow-hidden text-[11px] text-admin-foreground/55 transition-opacity duration-200",
                    isActive ? "pt-1 opacity-100" : "opacity-0",
                  )}
                >
                  {row.detail}
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Medidor radial para uma taxa única (frequência, ocupação, entrega). */
export function RadialGauge({
  value,
  label,
  caption,
  color = PALETTE.gold,
  size = 168,
}: {
  value: number;
  label: string;
  caption?: string;
  color?: string;
  size?: number;
}) {
  const ref = useRef<SVGCircleElement>(null);
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, value));
  const length = (progress / 100) * circumference;

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const tween = gsap.fromTo(
      el,
      { strokeDashoffset: length },
      {
        strokeDashoffset: 0,
        duration: 1.3,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [length]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={PALETTE.grid}
            strokeWidth={14}
          />
          <circle
            ref={ref}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${length} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-3xl font-semibold text-admin-foreground">
            {formatNumber(value, value % 1 === 0 ? 0 : 1)}%
          </span>
          <span className="text-[11px] uppercase tracking-wide text-admin-foreground/50">
            {label}
          </span>
        </div>
      </div>
      {caption && (
        <p className="mt-2 text-center text-xs text-admin-foreground/55">{caption}</p>
      )}
    </div>
  );
}

/**
 * Colunas compactas — carga de aulas por dia da semana.
 *
 * A coluna sob o ponteiro abre um balão com o detalhe (valor absoluto, fatia
 * do total e comparação com o pico) e as demais recuam em opacidade, para o
 * olho não perder qual está sendo lida.
 */
export function ColumnChart({
  data,
  height = 140,
  detailNoun = "aula(s)",
}: {
  data: { label: string; value: number }[];
  height?: number;
  /** Substantivo usado no balão de detalhe. */
  detailNoun?: string;
}) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div
      className="relative flex items-end gap-2"
      style={{ height }}
      onPointerLeave={() => setActive(null)}
    >
      {data.map((item, index) => {
        const ratio = item.value / max;
        const isActive = active === index;
        const dimmed = active !== null && !isActive;

        return (
          <div
            key={item.label}
            className={cn(
              "relative flex h-full flex-1 cursor-default flex-col justify-end gap-2",
              "transition-opacity duration-200",
              dimmed && "opacity-40",
            )}
            onPointerEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            tabIndex={0}
            aria-label={`${item.label}: ${formatNumber(item.value)} ${detailNoun}`}
          >
            <span
              className={cn(
                "tabular text-center text-xs transition-colors duration-200",
                isActive
                  ? "font-semibold text-admin-foreground"
                  : "font-medium text-admin-foreground/70",
              )}
            >
              {formatNumber(item.value)}
            </span>
            <motion.div
              className={cn(
                "w-full origin-bottom rounded-t-md transition-[filter] duration-200",
                isActive && "brightness-110",
                ratio >= 0.999
                  ? "bg-gradient-to-t from-gold-600 to-gold-400"
                  : "bg-gradient-to-t from-navy-800 to-navy-500",
              )}
              style={{ minHeight: 4 }}
              initial={reduced ? false : { height: 0 }}
              whileInView={{ height: `${Math.max(4, ratio * 100)}%` }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.7,
                delay: index * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
            <span
              className={cn(
                "text-center text-xs transition-colors duration-200",
                isActive
                  ? "font-medium text-admin-foreground"
                  : "text-admin-foreground/55",
              )}
            >
              {item.label}
            </span>
          </div>
        );
      })}

      {/* Balão dentro da área do gráfico: o card tem `overflow-hidden`, então
          um balão acima das colunas seria cortado. */}
      {active !== null && data[active] && (
        <ChartTooltip
          className="absolute top-0 w-max max-w-44 -translate-x-1/2 text-center"
          style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-admin-foreground/55">
            {data[active]!.label}
          </p>
          <p className="tabular mt-0.5 text-sm font-semibold text-admin-foreground">
            {formatNumber(data[active]!.value)} {detailNoun}
          </p>
          <p className="tabular mt-0.5 text-[11px] text-admin-foreground/55">
            {total > 0 ? formatNumber((100 * data[active]!.value) / total, 1) : "0"}% do
            total
            {data[active]!.value >= max && data[active]!.value > 0 ? " · pico" : ""}
          </p>
        </ChartTooltip>
      )}
    </div>
  );
}

/** Sparkline sem eixos, para dentro dos cards de KPI. */
export function Sparkline({
  values,
  color = PALETTE.gold,
  width = 120,
  height = 34,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, index) => ({
    x: index * step,
    y: height - (value / max) * (height - 4) - 2,
  }));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-8 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={smoothPath(points)}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
