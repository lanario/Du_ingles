"use client";

/**
 * Peças visuais da Auditoria: ícone por categoria, selo de gravidade,
 * avatar do autor e o indicador do topo.
 *
 * Mesma divisão de movimento do resto do painel — **Framer Motion** no ciclo
 * de vida do React (hover, entrada), **GSAP** no que é contínuo e imperativo
 * (o count-up, importado de `dashboard/primitives`). Nenhum nó é animado
 * pelas duas bibliotecas ao mesmo tempo.
 */

import { motion, useReducedMotion } from "framer-motion";
import { CountUp } from "@/components/features/admin/dashboard/primitives";
import {
  ArrowInIcon,
  CheckIcon,
  CoinIcon,
  EyeIcon,
  GraduationIcon,
  GroupsIcon,
  KeyIcon,
  MessageIcon,
  ShieldIcon,
  SwapIcon,
  TrashIcon,
  UserIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COPY,
  type AuditCategory,
  type AuditIconName,
  type AuditSeverity,
} from "./audit-utils";

const ICONS: Record<AuditIconName, typeof UserIcon> = {
  acesso: ArrowInIcon,
  pessoa: UserIcon,
  turma: GroupsIcon,
  aula: GraduationIcon,
  dinheiro: CoinIcon,
  mensagem: MessageIcon,
  privacidade: ShieldIcon,
  olho: EyeIcon,
  chave: KeyIcon,
  lixeira: TrashIcon,
  troca: SwapIcon,
  check: CheckIcon,
};

export function AuditIcon({
  name,
  className,
}: {
  name: AuditIconName;
  className?: string;
}) {
  const Icon = ICONS[name] ?? CheckIcon;
  return <Icon className={className} />;
}

/**
 * Cor por categoria. Fica no navy/dourado da marca; vermelho é reservado ao
 * que é destrutivo, para que ele salte na varredura visual da lista.
 */
export const CATEGORY_TONE: Record<AuditCategory, { chip: string; medal: string }> = {
  acesso: {
    chip: "bg-navy-50 text-navy-700 ring-navy-100",
    medal: "bg-navy-50 text-navy-700 ring-navy-100",
  },
  pessoas: {
    chip: "bg-navy-50 text-navy-800 ring-navy-100",
    medal: "bg-navy-50 text-navy-800 ring-navy-100",
  },
  turmas: {
    chip: "bg-gold-50 text-gold-700 ring-gold-100",
    medal: "bg-gold-50 text-gold-700 ring-gold-100",
  },
  aulas: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    medal: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  financeiro: {
    chip: "bg-gold-50 text-gold-700 ring-gold-100",
    medal: "bg-gold-50 text-gold-700 ring-gold-100",
  },
  comunicacao: {
    chip: "bg-sky-50 text-sky-700 ring-sky-100",
    medal: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  privacidade: {
    chip: "bg-red-50 text-red-700 ring-red-100",
    medal: "bg-red-50 text-red-700 ring-red-100",
  },
};

export const SEVERITY_COPY: Record<AuditSeverity, { label: string; className: string }> =
  {
    rotina: { label: "Rotina", className: "text-admin-foreground/45" },
    atencao: {
      label: "Atenção",
      className: "bg-gold-50 text-gold-700 ring-1 ring-gold-100",
    },
    critico: {
      label: "Crítico",
      className: "bg-red-50 text-red-700 ring-1 ring-red-100",
    },
  };

/** Medalhão do evento — o ponto da linha do tempo. */
export function EventMedal({
  icon,
  category,
  severity,
}: {
  icon: AuditIconName;
  category: AuditCategory;
  severity: AuditSeverity;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      whileHover={reduceMotion ? undefined : { scale: 1.08 }}
      transition={{ type: "spring", stiffness: 360, damping: 22 }}
      className={cn(
        "relative z-10 grid h-9 w-9 flex-none place-items-center rounded-full ring-1",
        "shadow-[0_1px_2px_rgba(11,26,51,0.06)]",
        CATEGORY_TONE[category].medal,
      )}
    >
      <AuditIcon name={icon} className="h-4 w-4" />
      {severity === "critico" && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-admin-surface"
        />
      )}
      {severity === "atencao" && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-gold-500 ring-2 ring-admin-surface"
        />
      )}
    </motion.span>
  );
}

export function CategoryChip({ category }: { category: AuditCategory }) {
  const copy = CATEGORY_COPY[category];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        CATEGORY_TONE[category].chip,
      )}
    >
      <AuditIcon name={copy.icon} className="h-3 w-3" />
      {copy.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const copy = SEVERITY_COPY[severity];
  if (severity === "rotina") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        copy.className,
      )}
    >
      {copy.label}
    </span>
  );
}

/** Iniciais de quem agiu — evita depender de avatar carregado. */
export function ActorAvatar({ name, role }: { name: string; role: string | null }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <span
      title={name}
      className={cn(
        "grid h-6 w-6 flex-none place-items-center rounded-full text-[10px] font-semibold",
        role === "admin"
          ? "bg-navy-800 text-white"
          : role === "teacher"
            ? "bg-gold-500 text-navy-900"
            : "bg-navy-100 text-navy-800",
      )}
    >
      {initials || "?"}
    </span>
  );
}

/** Indicador do cabeçalho: número grande com count-up e rótulo curto. */
export function Indicator({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: number;
  tone?: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-admin-border bg-admin-surface px-3.5 py-2">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-admin-foreground/45">
        {label}
      </dt>
      <dd
        className="text-lg font-semibold tabular-nums"
        style={{ color: tone ?? "var(--admin-foreground)" }}
      >
        <CountUp value={value} suffix={suffix} duration={1} />
      </dd>
    </div>
  );
}
