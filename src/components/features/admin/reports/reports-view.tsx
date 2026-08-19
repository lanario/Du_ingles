"use client";

/**
 * Relatórios do painel: quatro leituras da mesma escola — resultado do mês,
 * receita por aluno, folha dos professores e o pedagógico.
 *
 * Duas decisões de arquitetura da tela:
 *
 * 1. **Competência e janela vivem na URL; aba e busca vivem no componente.**
 *    Trocar de mês é uma pergunta nova ao banco (e um link que o admin manda
 *    para o contador), então vai para a query string. Trocar de aba só
 *    reorganiza dado que já chegou — passar pela URL custaria um round-trip
 *    por clique.
 *
 * 2. **Movimento dividido como no resto do painel.** Framer Motion cuida do
 *    ciclo de vida do React (entrada dos cartões, troca de aba, layout) e o
 *    GSAP do que é contínuo (count-up dos valores, traçado do fio de
 *    resultado, barra de progresso da rolagem).
 */

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Card,
  CardHeader,
  EmptyState,
  Reveal,
  RevealGrid,
  RevealItem,
  ScrollProgressBar,
  formatNumber,
} from "@/components/features/admin/dashboard/primitives";
import { MONEY, formatBRL } from "@/components/features/admin/dashboard/finance-charts";
import { MonthPicker } from "@/components/features/admin/finance/finance-visuals";
import { formatDate } from "@/components/features/admin/finance/finance-utils";
import {
  DownloadIcon,
  GraduationIcon,
  SearchIcon,
  TrendDownIcon,
  TrendUpIcon,
  UserIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { AdminReport } from "@/repositories/reports";
import type {
  FinancialReport,
  ReportCategorySlice,
} from "@/repositories/financial-reports";
import { REPORT_WINDOWS, type ReportWindow } from "@/schemas/reports";
import { MoneyValue, RankList, ResultWaterfall, RevenueExpenseChart } from "./report-charts";
import { PedagogyPanel } from "./pedagogy-panel";

type TabId = "overview" | "students" | "teachers" | "pedagogy";

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "overview", label: "Receitas e despesas", hint: "Resultado do mês e tendência" },
  { id: "students", label: "Receita por aluno", hint: "Quem paga o quê" },
  { id: "teachers", label: "Professores", hint: "Comissão e salário" },
  { id: "pedagogy", label: "Pedagógico", hint: "Frequência e tarefas" },
];

/** Variação percentual entre duas competências. `null` sem base de comparação. */
function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round((1000 * (current - previous)) / previous) / 10;
}

function formatHours(minutes: number): string {
  return `${formatNumber(Math.round(minutes / 60))}h`;
}

export function ReportsView({
  report,
  pedagogy,
  organizationName,
}: {
  report: FinancialReport;
  pedagogy: AdminReport;
  organizationName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<TabId>("overview");

  function navigate(next: { mes?: string; janela?: ReportWindow }) {
    const params = new URLSearchParams({
      mes: next.mes ?? report.monthKey,
      janela: String(next.janela ?? report.windowMonths),
    });
    startTransition(() => router.push(`/admin/relatorios?${params}`, { scroll: false }));
  }

  const exportHref = `/api/relatorios/export?mes=${report.monthKey}&janela=${report.windowMonths}&escopo=${tab}`;

  return (
    <div className="pb-6">
      <ScrollProgressBar />

      <Reveal className="mb-6" y={16}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">
              {organizationName} · relatórios
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-admin-foreground">
              Relatórios
            </h1>
            <p className="mt-1.5 text-sm text-admin-foreground/60">
              Competência de{" "}
              <span className="font-medium text-admin-foreground/80">
                {report.monthTitle.toLowerCase()}
              </span>{" "}
              · tendência dos últimos {report.windowMonths} meses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <WindowPicker
              value={report.windowMonths}
              onChange={(janela) => navigate({ janela })}
              disabled={pending}
            />
            <MonthPicker
              monthKey={report.monthKey}
              previousKey={report.previousKey}
              nextKey={report.nextKey}
              currentKey={report.currentKey}
              onChange={(mes) => navigate({ mes })}
              pending={pending}
            />
            <a
              href={exportHref}
              className="inline-flex items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-3.5 py-2.5 text-xs font-semibold text-admin-foreground/70 transition-colors hover:border-gold-300 hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              <DownloadIcon className="h-4 w-4" />
              Baixar CSV
            </a>
          </div>
        </div>
      </Reveal>

      <Tabs value={tab} onChange={setTab} />

      <motion.div
        animate={{ opacity: pending ? 0.55 : 1 }}
        transition={{ duration: 0.2 }}
        className="mt-5"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "overview" && <OverviewTab report={report} />}
            {tab === "students" && <StudentsTab report={report} />}
            {tab === "teachers" && <TeachersTab report={report} />}
            {tab === "pedagogy" && <PedagogyPanel report={pedagogy} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/*                              Chrome da tela                               */
/* ------------------------------------------------------------------------ */

function Tabs({ value, onChange }: { value: TabId; onChange: (id: TabId) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Seções do relatório"
      className="flex flex-wrap gap-1 rounded-2xl border border-admin-border bg-admin-surface p-1"
    >
      {TABS.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative flex-1 rounded-xl px-4 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
              active ? "text-admin-foreground" : "text-admin-foreground/55 hover:text-admin-foreground/80",
            )}
          >
            {active && (
              <motion.span
                layoutId="report-tab"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-xl bg-admin-muted"
              />
            )}
            <span className="relative block text-sm font-semibold">{item.label}</span>
            <span className="relative block text-[11px] text-admin-foreground/45">
              {item.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WindowPicker({
  value,
  onChange,
  disabled,
}: {
  value: ReportWindow;
  onChange: (value: ReportWindow) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1">
      {REPORT_WINDOWS.map((months) => {
        const active = months === value;
        return (
          <button
            key={months}
            type="button"
            disabled={disabled}
            onClick={() => onChange(months)}
            aria-pressed={active}
            className={cn(
              "relative rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-50",
              active ? "text-admin-foreground" : "text-admin-foreground/50 hover:text-admin-foreground/80",
            )}
          >
            {active && (
              <motion.span
                layoutId="report-window"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-admin-muted"
              />
            )}
            <span className="relative">{months}m</span>
          </button>
        );
      })}
    </div>
  );
}

/** Cartão de indicador com valor em reais, variação e nota de rodapé. */
function MoneyTile({
  label,
  cents,
  tone,
  changePercent,
  deltaInvert,
  footnote,
  icon,
  emphasis,
}: {
  label: string;
  cents: number;
  tone: string;
  changePercent?: number | null;
  /** `true` quando crescer é ruim (despesa): o chip verde/vermelho inverte. */
  deltaInvert?: boolean;
  footnote?: ReactNode;
  icon?: ReactNode;
  emphasis?: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "group relative h-full overflow-hidden rounded-2xl border bg-admin-surface p-5",
        "shadow-[0_1px_2px_rgba(11,26,51,0.04),0_12px_32px_-24px_rgba(11,26,51,0.45)]",
        emphasis ? "border-transparent" : "border-admin-border",
      )}
      style={emphasis ? { boxShadow: `inset 0 0 0 1.5px ${tone}` } : undefined}
    >
      <span
        aria-hidden
        style={{ ["--tone" as string]: tone }}
        className="tone-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      {icon && (
        <span
          aria-hidden
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`, color: tone }}
        >
          {icon}
        </span>
      )}

      <p className="relative mt-3 text-[10px] font-medium uppercase tracking-[0.14em] text-admin-foreground/45">
        {label}
      </p>
      <p
        className="relative mt-1 text-xl font-semibold leading-tight tabular"
        style={{ color: tone }}
      >
        <MoneyValue cents={cents} />
      </p>

      <div className="relative mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        {changePercent !== undefined && (
          <Delta value={changePercent} invert={deltaInvert} />
        )}
        {footnote && <span className="text-admin-foreground/45">{footnote}</span>}
      </div>
    </motion.div>
  );
}

/** Chip de variação. Sobe é verde quando entra dinheiro — quem decide é quem chama. */
function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null) {
    return <span className="text-admin-foreground/40">sem base anterior</span>;
  }

  const up = value >= 0;
  const good = invert ? !up : up;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold tabular",
        good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
      )}
    >
      {up ? <TrendUpIcon className="h-3 w-3" /> : <TrendDownIcon className="h-3 w-3" />}
      {formatNumber(Math.abs(value), 1)}%
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/*                          Aba: receitas e despesas                         */
/* ------------------------------------------------------------------------ */

function OverviewTab({ report }: { report: FinancialReport }) {
  const { totals, previousTotals } = report;
  const positive = totals.netCents >= 0;

  return (
    <div className="space-y-5">
      <RevealGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RevealItem>
          <MoneyTile
            label="Receitas do mês"
            cents={totals.revenueCents}
            tone={MONEY.revenue}
            icon={<WalletIcon className="h-4 w-4" />}
            changePercent={delta(totals.revenueCents, previousTotals.revenueCents)}
            footnote={`${totals.revenueCount} lançamento${totals.revenueCount === 1 ? "" : "s"}`}
          />
        </RevealItem>
        <RevealItem>
          <MoneyTile
            label="Despesas do mês"
            cents={totals.expenseCents}
            tone={MONEY.cost}
            icon={<TrendDownIcon className="h-4 w-4" />}
            changePercent={delta(totals.expenseCents, previousTotals.expenseCents)}
            deltaInvert
            footnote={`${totals.expenseCount} lançamento${totals.expenseCount === 1 ? "" : "s"}`}
          />
        </RevealItem>
        <RevealItem>
          <MoneyTile
            label="Resultado"
            cents={totals.netCents}
            tone={positive ? MONEY.revenue : MONEY.cost}
            emphasis
            icon={positive ? <TrendUpIcon className="h-4 w-4" /> : <TrendDownIcon className="h-4 w-4" />}
            changePercent={delta(totals.netCents, previousTotals.netCents)}
            footnote={
              totals.marginPercent == null
                ? "sem receita no mês"
                : `margem de ${formatNumber(totals.marginPercent, 1)}%`
            }
          />
        </RevealItem>
        <RevealItem>
          <MoneyTile
            label={`Acumulado ${report.windowMonths} meses`}
            cents={report.windowTotals.netCents}
            tone={report.windowTotals.netCents >= 0 ? MONEY.revenue : MONEY.cost}
            icon={<GraduationIcon className="h-4 w-4" />}
            footnote={`${formatBRL(report.windowTotals.revenueCents)} em receita`}
          />
        </RevealItem>
      </RevealGrid>

      <Reveal>
        <Card>
          <CardHeader
            title="Receitas × despesas por competência"
            subtitle="Despesa empilhada em folha e estrutura; o fio escuro é o resultado"
            action={
              <span className="text-[11px] text-admin-foreground/45">
                {report.series[0]?.label} – {report.series[report.series.length - 1]?.label}
              </span>
            }
          />
          <div className="p-5">
            {report.hasEntries ? (
              <RevenueExpenseChart points={report.series} />
            ) : (
              <EmptyState>
                Nenhum lançamento financeiro nesta janela. Registre receitas e despesas em
                Financeiro para o relatório ganhar corpo.
              </EmptyState>
            )}
          </div>
        </Card>
      </Reveal>

      <RevealGrid className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RevealItem>
          <Card className="h-full">
            <CardHeader
              title="Da receita ao resultado"
              subtitle="O que cada bloco de custo tirou da margem"
            />
            <div className="p-5">
              {totals.revenueCents === 0 && totals.expenseCents === 0 ? (
                <EmptyState>Nada lançado nesta competência.</EmptyState>
              ) : (
                <ResultWaterfall
                  steps={[
                    { label: "Receita", cents: totals.revenueCents, role: "in" },
                    { label: "Professores", cents: totals.professionalCostCents, role: "out" },
                    { label: "Estrutura", cents: totals.operatingExpenseCents, role: "out" },
                    { label: "Resultado", cents: totals.netCents, role: "result" },
                  ]}
                />
              )}
            </div>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className="h-full">
            <CardHeader
              title="Situação de caixa"
              subtitle="O que já foi liquidado e o que continua em aberto"
            />
            <div className="space-y-4 p-5">
              <SettlementBar
                label="Recebido"
                openLabel="A receber"
                settled={totals.revenuePaidCents}
                open={totals.revenueOpenCents}
                overdue={totals.revenueOverdueCents}
                tone={MONEY.revenue}
              />
              <SettlementBar
                label="Pago"
                openLabel="A pagar"
                settled={totals.expensePaidCents}
                open={totals.expenseOpenCents}
                overdue={totals.expenseOverdueCents}
                tone={MONEY.cost}
              />
            </div>
          </Card>
        </RevealItem>
      </RevealGrid>

      <RevealGrid className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RevealItem>
          <CategoryCard
            title="Receitas por linha de negócio"
            subtitle="Composição da entrada no mês"
            slices={report.revenueCategories}
            tone={MONEY.revenue}
          />
        </RevealItem>
        <RevealItem>
          <CategoryCard
            title="Despesas por natureza"
            subtitle="Folha e estrutura, categoria a categoria"
            slices={report.expenseCategories}
            tone={MONEY.cost}
          />
        </RevealItem>
      </RevealGrid>
    </div>
  );
}

function SettlementBar({
  label,
  openLabel,
  settled,
  open,
  overdue,
  tone,
}: {
  label: string;
  openLabel: string;
  settled: number;
  open: number;
  overdue: number;
  tone: string;
}) {
  const reduced = useReducedMotion();
  const total = settled + open;
  const settledShare = total > 0 ? settled / total : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-admin-foreground/75">
          {label}{" "}
          <span className="tabular font-semibold" style={{ color: tone }}>
            {formatBRL(settled)}
          </span>
        </span>
        <span className="text-admin-foreground/55">
          {openLabel}{" "}
          <span className="tabular font-medium text-admin-foreground/75">
            {formatBRL(open)}
          </span>
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-admin-muted">
        <motion.div
          className="relative h-full rounded-full"
          style={{ backgroundColor: tone }}
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${Math.max(settledShare * 100, total > 0 && settled > 0 ? 2 : 0)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <span aria-hidden className="progress-shimmer absolute inset-0 block" />
        </motion.div>
      </div>
      <p className="mt-1.5 text-[11px] text-admin-foreground/45">
        {formatNumber(settledShare * 100, 1)}% liquidado
        {overdue > 0 && (
          <span className="ml-2 rounded-full bg-red-50 px-1.5 py-0.5 font-semibold text-red-700">
            {formatBRL(overdue)} vencido
          </span>
        )}
      </p>
    </div>
  );
}

function CategoryCard({
  title,
  subtitle,
  slices,
  tone,
}: {
  title: string;
  subtitle: string;
  slices: ReportCategorySlice[];
  tone: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <span className="text-[11px] text-admin-foreground/45">
            {slices.length} {slices.length === 1 ? "categoria" : "categorias"}
          </span>
        }
      />
      <div className="px-5 py-2">
        {slices.length === 0 ? (
          <div className="py-3">
            <EmptyState>Nada lançado nesta competência.</EmptyState>
          </div>
        ) : (
          <RankList
            rows={slices.map((slice) => ({
              id: slice.id,
              label: slice.label,
              cents: slice.cents,
              share: slice.share,
              meta: `${slice.count} lanç.`,
            }))}
            tone={tone}
          />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------------ */
/*                          Aba: receita por aluno                           */
/* ------------------------------------------------------------------------ */

function StudentsTab({ report }: { report: FinancialReport }) {
  const [term, setTerm] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const { studentSummary: summary } = report;

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return report.students.filter((row) => {
      if (onlyOpen && row.openCents === 0) return false;
      if (!needle) return true;
      return `${row.name} ${row.planName ?? ""}`.toLowerCase().includes(needle);
    });
  }, [report.students, term, onlyOpen]);

  return (
    <div className="space-y-5">
      <RevealGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RevealItem>
          <MoneyTile
            label="Receita identificada"
            cents={summary.identifiedCents}
            tone={MONEY.revenue}
            icon={<UserIcon className="h-4 w-4" />}
            footnote={`${summary.payingStudents} aluno${summary.payingStudents === 1 ? "" : "s"} pagante${summary.payingStudents === 1 ? "" : "s"}`}
          />
        </RevealItem>
        <RevealItem>
          <MoneyTile
            label="Ticket médio"
            cents={summary.averageTicketCents ?? 0}
            tone={MONEY.ink}
            icon={<WalletIcon className="h-4 w-4" />}
            footnote={
              summary.activeSubscriptions > 0
                ? `${summary.activeSubscriptions} assinatura(s) ativa(s)`
                : "sem assinatura ativa na plataforma"
            }
          />
        </RevealItem>
        <RevealItem>
          <MoneyTile
            label="Sem aluno identificado"
            cents={summary.unidentifiedCents}
            tone={summary.unidentifiedCents > 0 ? MONEY.expense : MONEY.muted}
            icon={<SearchIcon className="h-4 w-4" />}
            footnote="lançamentos sem contraparte reconhecida"
          />
        </RevealItem>
        <RevealItem>
          <Card className="h-full">
            <div className="p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-admin-foreground/45">
                Concentração
              </p>
              <p className="mt-1 text-xl font-semibold leading-tight tabular text-admin-foreground">
                {summary.topShare == null ? "—" : `${formatNumber(summary.topShare * 100, 1)}%`}
              </p>
              <p className="mt-1.5 text-[11px] text-admin-foreground/45">
                {report.students[0]?.identified
                  ? `maior pagador: ${report.students[0]?.name}`
                  : "nenhum pagador identificado"}
              </p>
            </div>
          </Card>
        </RevealItem>
      </RevealGrid>

      <Reveal>
        <Card>
          <CardHeader
            title="Receita por aluno"
            subtitle="Barra cheia é o que já foi recebido; o restante segue em aberto"
            action={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyOpen((value) => !value)}
                  aria-pressed={onlyOpen}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                    onlyOpen
                      ? "border-transparent bg-admin-muted text-admin-foreground"
                      : "border-admin-border text-admin-foreground/55 hover:text-admin-foreground",
                  )}
                >
                  Em aberto
                </button>
                <label className="relative">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-admin-foreground/40" />
                  <input
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Buscar aluno"
                    aria-label="Buscar aluno"
                    className="w-44 rounded-lg border border-admin-border bg-admin-surface py-1.5 pl-8 pr-2.5 text-xs text-admin-foreground placeholder:text-admin-foreground/40 focus:border-gold-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  />
                </label>
              </div>
            }
          />
          <div className="px-5 py-2">
            {rows.length === 0 ? (
              <div className="py-3">
                <EmptyState>
                  {report.students.length === 0
                    ? "Nenhuma receita lançada nesta competência."
                    : "Nenhum aluno corresponde ao filtro."}
                </EmptyState>
              </div>
            ) : (
              <RankList
                tone={MONEY.revenue}
                rows={rows.map((row) => ({
                  id: row.studentId ?? "unmatched",
                  label: row.name,
                  sublabel: row.planName ?? (row.identified ? undefined : "contraparte não cadastrada"),
                  cents: row.cents,
                  share: row.share,
                  settledShare: row.cents > 0 ? row.paidCents / row.cents : 0,
                  muted: !row.identified,
                  meta:
                    row.overdueCents > 0
                      ? `${formatBRL(row.overdueCents)} vencido`
                      : row.openCents > 0
                        ? `${formatBRL(row.openCents)} em aberto`
                        : row.lastPaidOn
                          ? `pago em ${formatDate(row.lastPaidOn)}`
                          : undefined,
                }))}
              />
            )}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/*                        Aba: comissão / salário                            */
/* ------------------------------------------------------------------------ */

function TeachersTab({ report }: { report: FinancialReport }) {
  const { payrollSummary: summary } = report;

  return (
    <div className="space-y-5">
      <RevealGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RevealItem>
          <MoneyTile
            label="Folha do mês"
            cents={summary.totalCents}
            tone={MONEY.cost}
            icon={<GraduationIcon className="h-4 w-4" />}
            footnote={`${summary.teachersPaid} professor(es) com lançamento`}
          />
        </RevealItem>
        <RevealItem>
          <Card className="h-full">
            <div className="p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-admin-foreground/45">
                Folha sobre receita
              </p>
              <p
                className="mt-1 text-xl font-semibold leading-tight tabular"
                style={{ color: MONEY.cost }}
              >
                {summary.shareOfRevenue == null
                  ? "—"
                  : `${formatNumber(summary.shareOfRevenue * 100, 1)}%`}
              </p>
              <p className="mt-1.5 text-[11px] text-admin-foreground/45">
                de {formatBRL(report.totals.revenueCents)} faturados
              </p>
            </div>
          </Card>
        </RevealItem>
        <RevealItem>
          <Card className="h-full">
            <div className="p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-admin-foreground/45">
                Aulas ministradas
              </p>
              <p className="mt-1 text-xl font-semibold leading-tight tabular text-admin-foreground">
                {formatNumber(summary.sessions)}
              </p>
              <p className="mt-1.5 text-[11px] text-admin-foreground/45">
                {formatHours(summary.minutes)} em sala nesta competência
              </p>
            </div>
          </Card>
        </RevealItem>
        <RevealItem>
          <MoneyTile
            label="Custo médio por hora"
            cents={summary.averageCostPerHourCents ?? 0}
            tone={MONEY.ink}
            icon={<WalletIcon className="h-4 w-4" />}
            footnote={
              summary.teachersWithoutEntry > 0
                ? `${summary.teachersWithoutEntry} professor(es) deram aula sem lançamento`
                : "todas as aulas com custo lançado"
            }
          />
        </RevealItem>
      </RevealGrid>

      <Reveal>
        <Card>
          <CardHeader
            title="Comissão e salário por professor"
            subtitle="Custo lançado no mês contra as aulas efetivamente dadas"
            action={
              <span className="text-[11px] text-admin-foreground/45">
                previsto = valor-hora do cadastro × horas
              </span>
            }
          />
          {report.teachers.length === 0 ? (
            <div className="p-5">
              <EmptyState>
                Nenhum custo com professor nem aula concluída nesta competência.
              </EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-admin-border text-left text-[10px] uppercase tracking-[0.12em] text-admin-foreground/45">
                    <th className="px-5 py-2.5 font-medium">Professor</th>
                    <th className="px-3 py-2.5 text-right font-medium">Aulas</th>
                    <th className="px-3 py-2.5 text-right font-medium">Horas</th>
                    <th className="px-3 py-2.5 text-right font-medium">Custo</th>
                    <th className="px-3 py-2.5 text-right font-medium">Por hora</th>
                    <th className="px-5 py-2.5 text-right font-medium">Previsto</th>
                  </tr>
                </thead>
                <tbody>
                  {report.teachers.map((row, index) => (
                    <motion.tr
                      key={row.teacherId ?? "unmatched"}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.035 }}
                      className="border-b border-admin-border/70 last:border-0 transition-colors hover:bg-admin-muted/40"
                    >
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "block truncate",
                            row.identified
                              ? "font-medium text-admin-foreground"
                              : "italic text-admin-foreground/55",
                          )}
                        >
                          {row.name}
                        </span>
                        <span className="text-[11px] text-admin-foreground/45">
                          {row.share > 0
                            ? `${formatNumber(row.share * 100, 1)}% da folha`
                            : "sem custo lançado"}
                          {row.openCents > 0 && ` · ${formatBRL(row.openCents)} a pagar`}
                        </span>
                      </td>
                      <td className="tabular px-3 py-3 text-right text-admin-foreground/75">
                        {formatNumber(row.sessions)}
                      </td>
                      <td className="tabular px-3 py-3 text-right text-admin-foreground/75">
                        {formatHours(row.minutes)}
                      </td>
                      <td
                        className="tabular px-3 py-3 text-right font-semibold"
                        style={{ color: row.cents > 0 ? MONEY.cost : MONEY.muted }}
                      >
                        {formatBRL(row.cents)}
                      </td>
                      <td className="tabular px-3 py-3 text-right text-admin-foreground/75">
                        {row.costPerHourCents == null ? "—" : formatBRL(row.costPerHourCents)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {row.estimatedCents == null ? (
                          <span className="text-admin-foreground/40">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span className="tabular text-admin-foreground/60">
                              {formatBRL(row.estimatedCents)}
                            </span>
                            <VarianceChip actual={row.cents} expected={row.estimatedCents} />
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Reveal>
    </div>
  );
}

/**
 * Diferença entre o que o cadastro previa pagar e o que foi lançado. Acima do
 * previsto é vermelho: é dinheiro saindo além do combinado.
 */
function VarianceChip({ actual, expected }: { actual: number; expected: number }) {
  if (expected <= 0 || actual === 0) return null;
  const diff = Math.round((1000 * (actual - expected)) / expected) / 10;
  if (Math.abs(diff) < 1) {
    return (
      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
        no previsto
      </span>
    );
  }

  const over = diff > 0;
  return (
    <span
      className={cn(
        "tabular rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        over ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700",
      )}
    >
      {over ? "+" : "−"}
      {formatNumber(Math.abs(diff), 1)}%
    </span>
  );
}
