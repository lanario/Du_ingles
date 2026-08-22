"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { IncomeStatement, RevenuePoint } from "@/repositories/finance";
import { formatNumber, useMeasuredWidth } from "./primitives";
import { niceCeil, prefersReducedMotion, smoothPath } from "./charts";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Dinheiro foge da paleta navy/ouro do painel de propósito: verde/vermelho é
 * a única convenção que o admin lê sem legenda. Em hex porque o SVG precisa
 * da cor por atributo de apresentação (mesmo motivo de `charts.tsx`).
 */
export const MONEY = {
  revenue: "#0f9d76",
  revenueSoft: "#34d399",
  cost: "#e11d48",
  costSoft: "#fb7185",
  expense: "#f97316",
  expenseSoft: "#fdba74",
  grid: "#e3e9f3",
  muted: "#5a6b85",
  ink: "#0b1a33",
} as const;

/**
 * Valores vêm em centavos inteiros do banco. Os centavos só aparecem quando
 * existem — `R$ 1.240` lê melhor que `R$ 1.240,00` num painel, e nenhum
 * arredondamento acontece: a decisão é só de exibição.
 */
export function formatBRL(cents: number): string {
  const reais = cents / 100;
  const decimals = Number.isInteger(reais) ? 0 : 2;
  const sign = reais < 0 ? "-" : "";
  return `${sign}R$ ${formatNumber(Math.abs(reais), decimals)}`;
}

/** Versão curta para a régua do eixo Y: `R$ 12 mil`, `R$ 1,2 mi`. */
function formatBRLAxis(cents: number): string {
  const reais = cents / 100;
  const abs = Math.abs(reais);
  if (abs >= 1_000_000) return `R$ ${formatNumber(reais / 1_000_000, 1)} mi`;
  if (abs >= 10_000) return `R$ ${formatNumber(reais / 1000, 0)} mil`;
  return `R$ ${formatNumber(reais, 0)}`;
}

/**
 * Count-up em moeda. O valor final já sai renderizado do servidor e o tween
 * só reescreve `textContent` depois da hidratação — sem flash nem mismatch.
 *
 * Ao contrário do `CountUp` de `primitives.tsx`, o tween é criado *dentro* do
 * `onEnter` do ScrollTrigger em vez de ser passado como opção. Passar como
 * opção faz o GSAP renderizar o tween no tempo 0 já na criação, e esse
 * primeiro frame reescreve o valor do servidor como `R$ 0` — que fica na tela
 * enquanto o card estiver fora da viewport ou a aba em segundo plano (rAF
 * congelado). Zerar receita na tela é caro demais para valer a economia.
 */
function MoneyCountUp({
  cents,
  className,
  duration = 1.2,
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
      start: "top 94%",
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
      // Interrupção no meio do tween deixaria um valor parcial congelado.
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
/*                            Receita mês a mês                              */
/* ------------------------------------------------------------------------ */

const CHART_FALLBACK_WIDTH = 760;
const PAD = { left: 62, right: 18, top: 20, bottom: 30 };

/**
 * Série de receita com área preenchida, crosshair e ponto destacado no mês
 * corrente. Uma linha só — o DRE ao lado é que abre a composição; empilhar
 * custo aqui competiria com ele e dobraria a leitura.
 */
export function RevenueAreaChart({
  points,
  height = 240,
}: {
  points: RevenuePoint[];
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [wrapRef, chartWidth] = useMeasuredWidth(CHART_FALLBACK_WIDTH);

  // Num card estreito o eixo Y em reais não cabe nos 62px de gutter, e a
  // altura de 260 vira um retângulo quase quadrado — os dois encolhem junto
  // com a viewport. `pad` precisa ser estável entre renders: ele entra nas
  // dependências do `geometry`, que por sua vez re-cria os tweens do GSAP.
  const compact = chartWidth < 520;
  const pad = useMemo(() => (compact ? { ...PAD, left: 44, bottom: 26 } : PAD), [compact]);
  const chartHeight = compact ? Math.min(height, 200) : height;

  const geometry = useMemo(() => {
    const innerW = chartWidth - pad.left - pad.right;
    const innerH = chartHeight - pad.top - pad.bottom;
    // A régua é calculada em reais para o "arredondar bonito" cair em
    // 3/6/9/12 e não em múltiplos de centavo.
    const maxCents =
      niceCeil(Math.max(1, ...points.map((p) => p.revenueCents / 100))) * 100;
    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
    const x = (index: number) => pad.left + index * stepX;
    const y = (cents: number) => pad.top + innerH * (1 - cents / maxCents);

    const coords = points.map((point, index) => ({
      x: x(index),
      y: y(point.revenueCents),
    }));
    const line = smoothPath(coords);
    const baseline = pad.top + innerH;
    const area =
      coords.length > 0
        ? `${line} L${coords[coords.length - 1]!.x},${baseline} L${coords[0]!.x},${baseline} Z`
        : "";

    return { innerH, maxCents, x, y, line, area, baseline, coords };
  }, [points, chartWidth, chartHeight, pad]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const path = svg.querySelector<SVGPathElement>("[data-revenue-line]");
      if (path) {
        const length = path.getTotalLength();
        gsap.fromTo(
          path,
          { strokeDasharray: length, strokeDashoffset: length },
          {
            strokeDashoffset: 0,
            duration: 1.7,
            ease: "power2.inOut",
            scrollTrigger: { trigger: svg, start: "top 88%", once: true },
            // Solta o dash depois, senão o crosshair "corta" a linha.
            onComplete: () => {
              path.style.strokeDasharray = "none";
            },
          },
        );
      }

      gsap.from(svg.querySelectorAll("[data-revenue-area]"), {
        opacity: 0,
        duration: 1.1,
        delay: 0.45,
        ease: "power1.out",
        scrollTrigger: { trigger: svg, start: "top 88%", once: true },
      });

      gsap.from(svg.querySelectorAll("[data-revenue-head]"), {
        scale: 0,
        transformOrigin: "center",
        duration: 0.5,
        delay: 1.5,
        ease: "back.out(2.2)",
        scrollTrigger: { trigger: svg, start: "top 88%", once: true },
      });
    }, svg);

    return () => ctx.revert();
  }, [geometry]);

  function handlePointer(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    // O `viewBox` agora nasce da largura medida, então a escala é 1 — mas o
    // cálculo continua tolerante a diferenças (zoom do navegador, `transform`
    // de ancestral) em vez de assumir paridade.
    const scale = rect.width / chartWidth;
    const localX = (event.clientX - rect.left) / scale;
    const innerW = chartWidth - pad.left - pad.right;
    const step = points.length > 1 ? innerW / (points.length - 1) : innerW;
    const index = Math.round((localX - pad.left) / step);
    setActive(Math.min(points.length - 1, Math.max(0, index)));
  }

  // Com 12+ meses os rótulos colidem; mostra no máximo ~7, sempre incluindo
  // o primeiro, e o mês sob o crosshair aparece independente do salto.
  const stride = Math.max(1, Math.ceil(points.length / 7));
  const last = points.length - 1;
  const activePoint = active !== null ? points[active] : null;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Receita mensal de ${points[0]?.label ?? ""} a ${points[last]?.label ?? ""}`}
        onPointerMove={handlePointer}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MONEY.revenue} stopOpacity="0.34" />
            <stop offset="70%" stopColor={MONEY.revenue} stopOpacity="0.06" />
            <stop offset="100%" stopColor={MONEY.revenue} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={MONEY.revenueSoft} />
            <stop offset="100%" stopColor={MONEY.revenue} />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = pad.top + geometry.innerH * ratio;
          return (
            <g key={ratio}>
              <line
                x1={pad.left}
                x2={chartWidth - pad.right}
                y1={y}
                y2={y}
                stroke={MONEY.grid}
                strokeWidth={1}
                strokeDasharray={ratio === 1 ? "0" : "3 5"}
              />
              <text
                x={pad.left - 12}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill={MONEY.muted}
              >
                {formatBRLAxis(geometry.maxCents * (1 - ratio))}
              </text>
            </g>
          );
        })}

        <path data-revenue-area d={geometry.area} fill={`url(#${uid}-fill)`} />
        <path
          data-revenue-line
          d={geometry.line}
          fill="none"
          stroke={`url(#${uid}-stroke)`}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cabeça da série: onde a escola está agora. */}
        {geometry.coords[last] && (
          <g data-revenue-head>
            <circle
              cx={geometry.coords[last]!.x}
              cy={geometry.coords[last]!.y}
              r={9}
              fill={MONEY.revenue}
              opacity={0.16}
            />
            <circle
              cx={geometry.coords[last]!.x}
              cy={geometry.coords[last]!.y}
              r={4}
              fill="#ffffff"
              stroke={MONEY.revenue}
              strokeWidth={2.5}
            />
          </g>
        )}

        {active !== null && (
          <g pointerEvents="none">
            <line
              x1={geometry.x(active)}
              x2={geometry.x(active)}
              y1={pad.top}
              y2={geometry.baseline}
              stroke={MONEY.revenue}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <circle
              cx={geometry.x(active)}
              cy={geometry.y(points[active]!.revenueCents)}
              r={5}
              fill="#ffffff"
              stroke={MONEY.revenue}
              strokeWidth={2.5}
            />
          </g>
        )}

        {points.map((point, index) =>
          index % stride === 0 || index === active ? (
            <text
              key={point.key}
              x={geometry.x(index)}
              y={chartHeight - 8}
              textAnchor={index === 0 ? "start" : index === last ? "end" : "middle"}
              fontSize="11"
              fill={index === active ? MONEY.ink : MONEY.muted}
              fontWeight={index === active ? 600 : 400}
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>

      {activePoint && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-32 -translate-x-1/2 rounded-lg border border-admin-border bg-white/95 px-3 py-2 text-center shadow-lg backdrop-blur"
          style={{ left: `${((geometry.x(active!) / chartWidth) * 100).toFixed(2)}%` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-admin-foreground/55">
            {activePoint.label}
          </p>
          <p className="tabular mt-0.5 text-sm font-semibold text-admin-foreground">
            {formatBRL(activePoint.revenueCents)}
          </p>
          {/* Detalhe que só o hover revela: como esse mês se compara ao anterior. */}
          {(() => {
            const previous = points[active! - 1];
            if (!previous) {
              return (
                <p className="mt-0.5 text-[11px] text-admin-foreground/45">
                  primeiro mês da série
                </p>
              );
            }
            if (previous.revenueCents <= 0) {
              return (
                <p className="mt-0.5 text-[11px] text-admin-foreground/45">
                  sem base de comparação
                </p>
              );
            }
            const change =
              (100 * (activePoint.revenueCents - previous.revenueCents)) /
              previous.revenueCents;
            const up = change >= 0;
            return (
              <p
                className={cn(
                  "tabular mt-0.5 text-[11px] font-medium",
                  up ? "text-emerald-700" : "text-red-700",
                )}
              >
                {up ? "▲" : "▼"} {formatNumber(Math.abs(change), 1)}% vs.{" "}
                {previous.label}
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/*                             DRE simplificado                              */
/* ------------------------------------------------------------------------ */

interface StatementRow {
  label: string;
  cents: number;
  /** Sinal contábil: entrada soma, saída subtrai. */
  direction: "in" | "out";
  from: string;
  to: string;
}

/**
 * DRE de uma linha por conta: rótulo, valor e uma barra proporcional à maior
 * conta do mês. A barra é o que dá noção de peso — sem ela, três números
 * soltos não dizem se a despesa está grande.
 */
/** Peso de uma conta sobre a receita bruta — `—` quando não há receita. */
function shareOfRevenue(cents: number, grossRevenueCents: number): string {
  if (grossRevenueCents <= 0) return "sem receita como base";
  return `${formatNumber((100 * cents) / grossRevenueCents, 1)}% da receita bruta`;
}

export function IncomeStatementPanel({ statement }: { statement: IncomeStatement }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  const rows: StatementRow[] = [
    {
      label: "Receita Bruta",
      cents: statement.grossRevenueCents,
      direction: "in",
      from: MONEY.revenue,
      to: MONEY.revenueSoft,
    },
    {
      label: "Custos Profissionais",
      cents: statement.professionalCostCents,
      direction: "out",
      from: MONEY.cost,
      to: MONEY.costSoft,
    },
    {
      label: "Despesas Operacionais",
      cents: statement.operatingExpenseCents,
      direction: "out",
      from: MONEY.expense,
      to: MONEY.expenseSoft,
    },
  ];

  // Escala comum às três barras: só assim a despesa é comparável à receita.
  const ceiling = Math.max(1, ...rows.map((row) => row.cents));
  const positive = statement.netResultCents >= 0;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 p-5">
      <ul className="min-w-0 space-y-2" onPointerLeave={() => setActive(null)}>
        {rows.map((row, index) => {
          const isActive = active === row.label;
          const dimmed = active !== null && !isActive;

          return (
            <li
              key={row.label}
              className={cn(
                "-mx-2 min-w-0 rounded-lg px-2 py-1.5",
                "transition-[background-color,opacity] duration-200",
                isActive && "bg-admin-muted/60",
                dimmed && "opacity-45",
              )}
              onPointerEnter={() => setActive(row.label)}
              onFocus={() => setActive(row.label)}
              onBlur={() => setActive(null)}
              tabIndex={0}
            >
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 truncate text-sm text-admin-foreground/80">
                  <span aria-hidden className="text-xs" style={{ color: row.from }}>
                    {row.direction === "in" ? "↗" : "↘"}
                  </span>
                  <span className="truncate">{row.label}</span>
                </span>
                <span
                  className="tabular flex-none text-sm font-semibold"
                  style={{ color: row.direction === "in" ? MONEY.ink : row.from }}
                >
                  {row.direction === "out" && "- "}
                  <MoneyCountUp cents={row.cents} duration={1 + index * 0.12} />
                </span>
              </div>
              <div
                className={cn(
                  "mt-1.5 overflow-hidden rounded-full bg-admin-muted transition-[height] duration-200",
                  isActive ? "h-2.5" : "h-1.5",
                )}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${row.from}, ${row.to})` }}
                  initial={reduced ? false : { width: 0 }}
                  whileInView={{ width: `${(100 * row.cents) / ceiling}%` }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.9,
                    delay: 0.1 + index * 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>

              {/* Detalhe da conta: só o hover abre. Grid 0fr→1fr anima a
                  altura sem precisar medir o texto. */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isActive ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div
                  className={cn(
                    "overflow-hidden transition-opacity duration-200",
                    isActive ? "pt-1.5 opacity-100" : "opacity-0",
                  )}
                >
                  <p className="tabular flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] text-admin-foreground/60">
                    <span>
                      {row.direction === "in"
                        ? "Base do mês (100% da receita)"
                        : shareOfRevenue(row.cents, statement.grossRevenueCents)}
                    </span>
                    <span>
                      {formatNumber((100 * row.cents) / ceiling, 1)}% da maior conta
                      do mês
                    </span>
                    <span>
                      Impacto no resultado:{" "}
                      {row.direction === "in" ? "+" : "-"}
                      {formatBRL(row.cents)}
                    </span>
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <motion.div
        className={cn(
          "relative mt-auto overflow-hidden rounded-xl border px-4 py-3.5",
          positive
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-red-200 bg-red-50/70",
        )}
        initial={reduced ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Brilho que cruza a caixa uma vez, marcando o número que fecha o mês. */}
        {!reduced && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent"
            initial={{ x: 0, opacity: 0 }}
            whileInView={{ x: "420%", opacity: [0, 1, 0] }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 1.15, delay: 0.9, ease: "easeInOut" }}
          />
        )}
        <div className="relative flex min-w-0 items-baseline justify-between gap-3">
          <span
            className={cn(
              "truncate text-sm font-semibold",
              positive ? "text-emerald-800" : "text-red-800",
            )}
          >
            Resultado Líquido
          </span>
          <MoneyCountUp
            cents={statement.netResultCents}
            duration={1.5}
            className={cn(
              "flex-none text-base font-bold",
              positive ? "text-emerald-700" : "text-red-700",
            )}
          />
        </div>
        <p
          className={cn(
            "relative mt-0.5 text-[11px]",
            positive ? "text-emerald-700/70" : "text-red-700/70",
          )}
        >
          {statement.marginPercent === null
            ? "Sem receita lançada no mês"
            : `Margem de ${formatNumber(statement.marginPercent, 1)}% sobre a receita bruta`}
        </p>
      </motion.div>
    </div>
  );
}
