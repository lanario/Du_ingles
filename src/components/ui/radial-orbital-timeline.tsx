"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { GraduationIcon, type IconProps } from "@/components/ui/icons";

export interface OrbitalItem {
  id: number;
  /** Rótulo curto dentro do nó (ex.: "A1"). */
  code: string;
  title: string;
  /** Linha de apoio no cabeçalho do card (ex.: "~80h de estudo"). */
  meta: string;
  content: string;
  category: string;
  icon: ComponentType<IconProps>;
  relatedIds: number[];
  /** 0–100. Alimenta a barra de domínio e o halo do nó. */
  energy: number;
  /** Cor do nó — token da paleta (ex.: `var(--navy-500)`). */
  tone: string;
}

interface RadialOrbitalTimelineProps {
  items: OrbitalItem[];
  className?: string;
}

/**
 * Órbita radial interativa: os nós giram sozinhos, e o clique em um deles
 * congela a rotação, traz o nó para a frente (270°) e abre um card com os
 * relacionados destacados. O original é preto-sobre-preto; aqui a mesma
 * mecânica roda na paleta da marca — canvas branco, navy nos nós e dourado
 * no núcleo/acentos.
 */
export function RadialOrbitalTimeline({ items, className }: RadialOrbitalTimelineProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [radius, setRadius] = useState(200);
  const [reduceMotion, setReduceMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const expandedIdRef = useRef<number | null>(null);

  // O estado do giro vive em refs e é escrito direto no DOM a cada quadro,
  // sem passar por render do React — 60fps estáveis no lugar de 20
  // re-renders por segundo.
  const nodeRefs = useRef<Array<HTMLDivElement | null>>([]);
  const angleRef = useRef(0);
  const targetAngleRef = useRef<number | null>(null);
  const autoRotateRef = useRef(true);
  const radiusRef = useRef(radius);
  const relatedIdsRef = useRef<number[]>([]);

  const getPosition = (index: number, angle: number, orbitRadius: number) => {
    const nodeAngle = ((index / items.length) * 360 + angle) % 360;
    const radian = (nodeAngle * Math.PI) / 180;
    return {
      x: orbitRadius * Math.cos(radian),
      y: orbitRadius * Math.sin(radian),
      // Quem está "à frente" (parte de baixo da elipse) cobre e aparece mais.
      zIndex: Math.round(100 + 50 * Math.sin(radian)),
      opacity: Math.max(0.45, Math.min(1, 0.45 + 0.55 * ((1 + Math.sin(radian)) / 2))),
    };
  };

  const applyPositions = useCallback(() => {
    const angle = angleRef.current;
    const orbitRadius = radiusRef.current;
    items.forEach((item, index) => {
      const el = nodeRefs.current[index];
      if (!el) return;
      const nodeAngle = ((index / items.length) * 360 + angle) % 360;
      const radian = (nodeAngle * Math.PI) / 180;
      const isExpanded = expandedIdRef.current === item.id;
      const isRelated = relatedIdsRef.current.includes(item.id);
      const isDimmed = expandedIdRef.current !== null && !isExpanded && !isRelated;
      const depth = (1 + Math.sin(radian)) / 2;
      el.style.transform = `translate3d(${orbitRadius * Math.cos(radian)}px, ${orbitRadius * Math.sin(radian)}px, 0)`;
      el.style.zIndex = String(
        isExpanded ? 300 : isRelated ? 250 : Math.round(100 + 50 * Math.sin(radian)),
      );
      el.style.opacity = String(
        isExpanded
          ? 1
          : isDimmed
            ? 0.35
            : Math.max(0.45, Math.min(1, 0.45 + 0.55 * depth)),
      );
    });
  }, [items]);

  // Raio acompanha a largura disponível — no celular a órbita encolhe em vez
  // de vazar da tela.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const size = Math.min(el.clientWidth, el.clientHeight);
      const next = Math.max(96, Math.min(210, size * 0.34));
      radiusRef.current = next;
      setRadius(next);
      applyPositions();
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [applyPositions]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // Giro em requestAnimationFrame e proporcional ao delta de tempo: segue o
  // refresh da tela e não acumula atraso quando um quadro demora.
  useEffect(() => {
    applyPositions();
    if (reduceMotion) return;

    const DEGREES_PER_SECOND = 6;
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = Math.min(now - last, 100) / 1000;
      last = now;

      if (targetAngleRef.current !== null) {
        // Aproximação exponencial até o alvo: o nó clicado desliza para a
        // frente em vez de saltar.
        const diff = ((targetAngleRef.current - angleRef.current + 540) % 360) - 180;
        if (Math.abs(diff) < 0.1) {
          angleRef.current = targetAngleRef.current;
          targetAngleRef.current = null;
        } else {
          angleRef.current = (angleRef.current + diff * Math.min(1, delta * 7) + 360) % 360;
        }
        applyPositions();
      } else if (autoRotateRef.current) {
        angleRef.current = (angleRef.current + DEGREES_PER_SECOND * delta) % 360;
        applyPositions();
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [applyPositions, reduceMotion]);

  const centerViewOnNode = useCallback(
    (nodeId: number) => {
      const index = items.findIndex((item) => item.id === nodeId);
      if (index < 0) return;
      targetAngleRef.current = (((270 - (index / items.length) * 360) % 360) + 360) % 360;
    },
    [items],
  );

  const syncHighlights = useCallback(
    (id: number | null) => {
      expandedIdRef.current = id;
      relatedIdsRef.current = id
        ? (items.find((item) => item.id === id)?.relatedIds ?? [])
        : [];
      applyPositions();
    },
    [applyPositions, items],
  );

  const toggleItem = useCallback(
    (id: number) => {
      if (expandedIdRef.current === id) {
        syncHighlights(null);
        setExpandedId(null);
        autoRotateRef.current = true;
        return;
      }
      syncHighlights(id);
      setExpandedId(id);
      autoRotateRef.current = false;
      centerViewOnNode(id);
    },
    [centerViewOnNode, syncHighlights],
  );

  const closeAll = () => {
    syncHighlights(null);
    setExpandedId(null);
    autoRotateRef.current = true;
  };

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === containerRef.current || event.target === orbitRef.current) {
      closeAll();
    }
  };

  const relatedIds = expandedId
    ? (items.find((item) => item.id === expandedId)?.relatedIds ?? [])
    : [];

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      onKeyDown={(event) => event.key === "Escape" && closeAll()}
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden",
        className,
      )}
    >
      <div
        ref={orbitRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "1000px" }}
      >
        {/* Anel da órbita */}
        <span
          aria-hidden
          className="absolute rounded-full border border-border"
          style={{ width: radius * 2, height: radius * 2 }}
        />
        <span
          aria-hidden
          className="absolute rounded-full border border-dashed border-navy-100"
          style={{ width: radius * 2 + 44, height: radius * 2 + 44 }}
        />

        {/* Núcleo */}
        <div
          aria-hidden
          className="absolute z-10 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-navy-800 via-navy-600 to-gold-500 shadow-[0_16px_36px_-12px_rgba(15,44,92,0.55)] motion-safe:animate-pulse"
        >
          <span className="absolute h-20 w-20 rounded-full border border-gold-400/60 opacity-70 motion-safe:animate-ping" />
          <span
            className="absolute h-24 w-24 rounded-full border border-navy-300/50 opacity-50 motion-safe:animate-ping"
            style={{ animationDelay: "0.5s" }}
          />
          <GraduationIcon className="h-7 w-7 text-white" />
        </div>

        {items.map((item, index) => {
          const position = getPosition(index, angleRef.current, radius);
          const isExpanded = expandedId === item.id;
          const isRelated = relatedIds.includes(item.id);
          const isDimmed = expandedId !== null && !isExpanded && !isRelated;
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              ref={(el) => {
                nodeRefs.current[index] = el;
              }}
              className="absolute cursor-pointer [will-change:transform,opacity]"
              style={{
                transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                zIndex: isExpanded ? 300 : isRelated ? 250 : position.zIndex,
                opacity: isExpanded ? 1 : isDimmed ? 0.35 : position.opacity,
              }}
              onClick={(event) => {
                event.stopPropagation();
                toggleItem(item.id);
              }}
            >
              {/* Halo proporcional ao domínio do nível */}
              <span
                aria-hidden
                className={cn(
                  "absolute rounded-full",
                  isRelated && "motion-safe:animate-pulse",
                )}
                style={{
                  background: `radial-gradient(circle, color-mix(in srgb, ${item.tone} 26%, transparent) 0%, transparent 70%)`,
                  width: item.energy * 0.5 + 48,
                  height: item.energy * 0.5 + 48,
                  left: `${-(item.energy * 0.5 + 48 - 48) / 2 - 4}px`,
                  top: `${-(item.energy * 0.5 + 48 - 48) / 2 - 4}px`,
                }}
              />

              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleItem(item.id);
                }}
                className={cn(
                  "relative grid h-12 w-12 place-items-center rounded-full border-2 text-sm font-bold",
                  "transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isExpanded && "scale-125 shadow-lg",
                  isRelated && "motion-safe:animate-pulse",
                )}
                style={{
                  color: isExpanded ? "#ffffff" : item.tone,
                  backgroundColor: isExpanded
                    ? item.tone
                    : isRelated
                      ? `color-mix(in srgb, ${item.tone} 18%, #ffffff)`
                      : `color-mix(in srgb, ${item.tone} 8%, #ffffff)`,
                  borderColor: isExpanded
                    ? item.tone
                    : `color-mix(in srgb, ${item.tone} ${isRelated ? "70%" : "40%"}, transparent)`,
                  boxShadow: isExpanded
                    ? `0 12px 28px -10px color-mix(in srgb, ${item.tone} 70%, transparent)`
                    : undefined,
                }}
              >
                {item.code}
              </button>

              <span
                className={cn(
                  "absolute left-1/2 top-14 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tracking-wide transition-all duration-300",
                  isExpanded ? "scale-110 text-foreground" : "text-muted-foreground",
                )}
              >
                {item.title}
              </span>

              {isExpanded && (
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="absolute left-1/2 top-24 w-64 -translate-x-1/2 rounded-xl border border-border bg-white/95 p-4 text-left shadow-[var(--shadow-card-hover)] backdrop-blur-md"
                >
                  <span
                    aria-hidden
                    className="absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-border"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        color: item.tone,
                        backgroundColor: `color-mix(in srgb, ${item.tone} 12%, #ffffff)`,
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      {item.category}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{item.meta}</span>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-foreground">
                    {item.code} · {item.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {item.content}
                  </p>

                  <div className="mt-3 border-t border-border pt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Domínio esperado</span>
                      <span className="font-semibold text-foreground">{item.energy}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-navy-600 to-gold-500 transition-[width] duration-700"
                        style={{ width: `${item.energy}%` }}
                      />
                    </div>
                  </div>

                  {item.relatedIds.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Níveis conectados
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.relatedIds.map((relatedId) => {
                          const related = items.find((entry) => entry.id === relatedId);
                          if (!related) return null;
                          return (
                            <button
                              key={relatedId}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleItem(relatedId);
                              }}
                              className="inline-flex h-6 items-center gap-1 rounded-full border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              {related.code} {related.title}
                              <span aria-hidden>→</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RadialOrbitalTimeline;
