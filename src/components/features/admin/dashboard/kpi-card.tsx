"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CountUp, DeltaBadge } from "./primitives";
import { Sparkline, PALETTE } from "./charts";

export type KpiTone = "navy" | "gold" | "neutral";

const TONE_RING: Record<KpiTone, string> = {
  navy: "bg-navy-50 text-navy-800",
  gold: "bg-gold-50 text-gold-700",
  neutral: "bg-admin-muted text-admin-foreground/70",
};

const TONE_TOP: Record<KpiTone, string> = {
  navy: "from-navy-800 via-navy-600 to-navy-300",
  gold: "from-gold-600 via-gold-500 to-gold-300",
  neutral: "from-admin-border via-admin-border to-transparent",
};

export interface KpiCardProps {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  hint?: string;
  icon: ReactNode;
  tone?: KpiTone;
  changePercent?: number | null;
  changeLabel?: string;
  trend?: number[];
}

/**
 * Cartão de métrica: filete superior colorido (navy ou dourado) como
 * codificação de família, número com count-up e, quando faz sentido, a
 * série dos últimos meses em sparkline.
 */
export function KpiCard({
  label,
  value,
  decimals = 0,
  suffix = "",
  hint,
  icon,
  tone = "navy",
  changePercent,
  changeLabel,
  trend,
}: KpiCardProps) {
  const reduced = useReducedMotion();

  return (
    <motion.article
      whileHover={reduced ? undefined : { y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-admin-border bg-admin-surface p-5",
        "shadow-[0_1px_2px_rgba(11,26,51,0.04),0_10px_30px_-20px_rgba(11,26,51,0.4)]",
        "transition-colors hover:border-gold-300",
      )}
    >
      <span
        className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", TONE_TOP[tone])}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-9 w-9 flex-none items-center justify-center rounded-xl",
            TONE_RING[tone],
          )}
          aria-hidden
        >
          {icon}
        </span>
        {trend && trend.length > 1 && (
          <span className="w-24 opacity-70 transition-opacity group-hover:opacity-100">
            <Sparkline
              values={trend}
              color={tone === "gold" ? PALETTE.gold : PALETTE.navyMid}
            />
          </span>
        )}
      </div>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-foreground/50">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-admin-foreground">
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </p>

      <div className="mt-auto pt-3">
        {changePercent !== undefined ? (
          <DeltaBadge changePercent={changePercent} label={changeLabel} />
        ) : (
          hint && <p className="text-xs text-admin-foreground/55">{hint}</p>
        )}
      </div>
    </motion.article>
  );
}

/* --------------------------------------------------------------------- */
/* Ícones inline — o projeto não usa lib de ícones; 24×24, traço 1.6.     */
/* --------------------------------------------------------------------- */

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const Icons = {
  students: (
    <Svg>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
  paying: (
    <Svg>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </Svg>
  ),
  teachers: (
    <Svg>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
    </Svg>
  ),
  groups: (
    <Svg>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </Svg>
  ),
  sessions: (
    <Svg>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M9 15l2 2 4-4" />
    </Svg>
  ),
  attendance: (
    <Svg>
      <path d="M9 11l2.5 2.5L16 8" />
      <circle cx="12" cy="12" r="9" />
    </Svg>
  ),
  risk: (
    <Svg>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </Svg>
  ),
  leads: (
    <Svg>
      <path d="M3 7l9 6 9-6" />
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </Svg>
  ),
  hours: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  assignments: (
    <Svg>
      <path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M15 3v5h5M9 13h6M9 17h4" />
    </Svg>
  ),
  courses: (
    <Svg>
      <path d="M4 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2H4Z" />
      <path d="M20 4h-6a3 3 0 0 0-1 2.5V20a2.5 2.5 0 0 1 2.5-2H20Z" />
    </Svg>
  ),
  seats: (
    <Svg>
      <path d="M5 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4" />
      <path d="M3 11h18v6H3zM7 17v3M17 17v3" />
    </Svg>
  ),
};
