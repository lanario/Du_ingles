/**
 * Prévia estática do painel do aluno para o hero.
 *
 * É uma *maquete* — dados fixos, nenhum fetch, nenhum client component — para
 * não custar nada ao LCP da home. O efeito 3D é CSS puro (`group-hover`):
 * inclinado em repouso, alinhado quando o mouse entra. Nada de framer-motion
 * aqui; a landing não precisa carregar runtime de animação só por um tilt.
 *
 * No celular a maquete não é uma redução da versão desktop: o par
 * "agenda | frequência" desempilha (lado a lado em 183px não sobra largura
 * para nenhum dos dois), a agenda mostra duas aulas em vez de três e os
 * tamanhos de fonte sobem um degrau. Abaixo de 11px o texto vira textura, e
 * uma maquete ilegível não prova nada.
 */

const SESSIONS = [
  {
    day: "Seg",
    date: "25",
    title: "Speaking: Job Interviews",
    group: "Turma B2 · Noite",
    time: "19:00",
    /** A terceira aula só entra quando há altura sobrando (>= sm). */
    compact: true,
  },
  {
    day: "Qua",
    date: "27",
    title: "Grammar: Past Perfect",
    group: "Turma B2 · Noite",
    time: "19:00",
    compact: true,
  },
  {
    day: "Sex",
    date: "29",
    title: "Listening: Podcasts",
    group: "Conversação",
    time: "20:00",
    compact: false,
  },
] as const;

const ATTENDANCE = [
  { name: "Turma B2 · Noite", rate: 92 },
  { name: "Conversação", rate: 78 },
] as const;

export function DashboardPreview() {
  return (
    <div className="group select-none [perspective:1600px]" aria-hidden>
      <div className="tilt-3d origin-center rounded-2xl border border-border bg-background p-3 shadow-[0_40px_80px_-40px_rgba(10,31,68,0.55)] sm:p-4">
        {/* Cabeçalho */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-600 sm:text-[9px]">
              Área do aluno
            </p>
            <p className="mt-0.5 text-base font-semibold tracking-tight text-navy-900">
              Olá, Marina 👋
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 bg-gold-50 px-2 py-1 text-[10px] font-medium text-gold-700">
            Nível
            <span className="rounded-full bg-navy-900 px-1.5 py-0.5 text-[9px] font-semibold text-gold-300">
              B2
            </span>
          </span>
        </div>

        {/* Destaque: próxima aula */}
        <div className="relative mt-3 overflow-hidden rounded-xl bg-navy-900 p-3.5 text-white sm:p-4">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-300 sm:text-[9px] sm:tracking-[0.16em]">
                  Próxima aula
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-success sm:text-[8px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Ao vivo
                </span>
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold">
                Speaking: Job Interviews
              </p>
              <p className="mt-0.5 truncate text-xs text-white/65 sm:text-[11px]">
                Turma B2 · Noite · 60 min
              </p>
            </div>
            <div className="flex-none text-right">
              <p className="tabular text-2xl font-semibold tracking-tight">19:00</p>
              <p className="mt-0.5 text-[10px] text-gold-300">segunda, 25 de agosto</p>
            </div>
          </div>
        </div>

        {/* KPIs — dois por linha quando a coluna é estreita (celular, e de
            novo em `md`, onde o hero vira duas colunas), quatro quando sobra
            largura. Com quatro colunas em ~310px, "Frequência" já vaza. */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
          <Stat label="Aulas" value="48" />
          <Stat label="Tarefas" value="2" tone="gold" />
          <Stat label="Frequência" value="92%" />
          <Stat label="Nota média" value="8,7" />
        </div>

        {/* Agenda da semana + frequência */}
        <div className="mt-3 grid gap-2 sm:grid-cols-5 md:grid-cols-1 lg:grid-cols-5">
          <div className="rounded-xl border border-border sm:col-span-3">
            <p className="border-b border-border px-3 py-2 text-xs font-semibold text-navy-900 sm:text-[11px]">
              Próximas aulas
            </p>
            <ul className="divide-y divide-border">
              {SESSIONS.map((session) => (
                <li
                  key={session.date}
                  className={`items-center gap-2.5 px-3 py-2 ${
                    session.compact ? "flex" : "hidden sm:flex"
                  }`}
                >
                  <div className="flex h-8 w-8 flex-none flex-col items-center justify-center rounded-lg border border-border bg-muted leading-none">
                    <span className="text-[8px] uppercase text-muted-foreground">
                      {session.day}
                    </span>
                    <span className="tabular text-[11px] font-semibold text-navy-900">
                      {session.date}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground sm:text-[11px]">
                      {session.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground sm:text-[10px]">
                      {session.group}
                    </p>
                  </div>
                  <span className="tabular flex-none text-xs font-medium text-navy-800 sm:text-[11px]">
                    {session.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border sm:col-span-2">
            <p className="border-b border-border px-3 py-2 text-xs font-semibold text-navy-900 sm:text-[11px]">
              Sua frequência
            </p>
            {/* Medidor e barras lado a lado enquanto o cartão é largo (celular
                em coluna única); empilhados quando ele vira 2/5 da grade. */}
            <div className="flex items-center gap-4 px-3 py-3 sm:block sm:space-y-3 md:flex md:space-y-0 lg:block lg:space-y-3">
              <div className="flex flex-none justify-center">
                <Gauge value={92} />
              </div>
              <ul className="min-w-0 flex-1 space-y-2">
                {ATTENDANCE.map((group) => (
                  <li key={group.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11px] text-foreground/85 sm:text-[10px]">
                        {group.name}
                      </span>
                      <span className="tabular text-[11px] font-semibold text-navy-900 sm:text-[10px]">
                        {group.rate}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-navy-800 to-navy-500"
                        style={{ width: `${group.rate}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "navy",
}: {
  label: string;
  value: string;
  tone?: "navy" | "gold";
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:text-[8px]">
        {label}
      </p>
      <p
        className={`mt-1 text-base font-semibold tracking-tight ${
          tone === "gold" ? "text-gold-700" : "text-navy-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** Mesmo desenho do RadialGauge do painel, porém estático. */
function Gauge({ value }: { value: number }) {
  const size = 82;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--gold-500)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-sm font-semibold text-navy-900">{value}%</span>
        <span className="text-[8px] text-muted-foreground">Geral</span>
      </div>
    </div>
  );
}
