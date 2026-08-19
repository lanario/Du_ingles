/**
 * Tradução do log técnico para a língua de quem administra a escola.
 *
 * O banco guarda `FINANCE_ENTRY_SETTLE`, `entity_type=finance_entry` e um
 * uuid — isso é rastro de sistema, não frase. Aqui cada ação vira uma oração
 * no passado ("deu baixa no lançamento Mensalidade — Maria"), com categoria,
 * gravidade e ícone. Nada de nome de função ou de tabela chega à tela.
 *
 * Módulo puro de propósito: é importado tanto pela página (servidor) quanto
 * pela lista (cliente).
 */

import type { AuditLogEntry } from "@/repositories/audit";

export type AuditCategory =
  | "acesso"
  | "pessoas"
  | "turmas"
  | "aulas"
  | "financeiro"
  | "comunicacao"
  | "privacidade";

/** Quanto a ação pesa numa revisão — muda só a cor do selo e a ordenação visual. */
export type AuditSeverity = "rotina" | "atencao" | "critico";

export type AuditIconName =
  | "acesso"
  | "pessoa"
  | "turma"
  | "aula"
  | "dinheiro"
  | "mensagem"
  | "privacidade"
  | "olho"
  | "chave"
  | "lixeira"
  | "troca"
  | "check";

export interface AuditCategoryCopy {
  label: string;
  /** Frase de apoio no cabeçalho da aba. */
  hint: string;
  icon: AuditIconName;
}

export const CATEGORY_COPY: Record<AuditCategory, AuditCategoryCopy> = {
  acesso: { label: "Acesso", hint: "Entradas e sessões", icon: "acesso" },
  pessoas: { label: "Pessoas", hint: "Contas e permissões", icon: "pessoa" },
  turmas: { label: "Turmas", hint: "Matrículas e cursos", icon: "turma" },
  aulas: { label: "Aulas", hint: "Encontros e tarefas", icon: "aula" },
  financeiro: { label: "Financeiro", hint: "Caixa, planos e cobrança", icon: "dinheiro" },
  comunicacao: { label: "Comunicação", hint: "Avisos e conversas", icon: "mensagem" },
  privacidade: { label: "Privacidade", hint: "Pedidos de LGPD", icon: "privacidade" },
};

interface PhraseContext {
  /** Nome do alvo já resolvido (turma, pessoa, lançamento…). */
  target: string | null;
  metadata: Record<string, unknown>;
  /** id → nome, para os ids citados no metadata. */
  references: Record<string, string>;
}

interface Descriptor {
  category: AuditCategory;
  severity: AuditSeverity;
  icon: AuditIconName;
  /** Oração no passado, sem sujeito: "criou a turma B1 — Noite". */
  phrase: (ctx: PhraseContext) => string;
}

// ---------------------------------------------------------------------------
// Formatadores de valor
// ---------------------------------------------------------------------------

const ROLE_LABEL: Record<string, string> = {
  admin: "administrador",
  teacher: "professor",
  student: "aluno",
};

export function roleLabel(role: string | null): string {
  if (!role) return "Sistema";
  const label = ROLE_LABEL[role];
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : role;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function money(value: unknown): string | null {
  return typeof value === "number" ? formatMoney(value) : null;
}

/** "a turma X" quando há nome; "a turma" quando o alvo sumiu do banco. */
function withName(article: string, noun: string, name: string | null): string {
  return name ? `${article} ${noun} ${name}` : `${article} ${noun}`;
}

function named(ctx: PhraseContext, key: string): string | null {
  const value = ctx.metadata[key];
  if (typeof value !== "string") return null;
  return ctx.references[value] ?? null;
}

// ---------------------------------------------------------------------------
// Catálogo de ações
// ---------------------------------------------------------------------------

const CATALOG: Record<string, Descriptor> = {
  // Acesso ------------------------------------------------------------------
  LOGIN: {
    category: "acesso",
    severity: "rotina",
    icon: "acesso",
    phrase: () => "entrou no sistema",
  },
  VIEW_AS_ENTER: {
    category: "acesso",
    severity: "atencao",
    icon: "olho",
    phrase: (ctx) => {
      const role = text(ctx.metadata.role);
      return role
        ? `passou a navegar como ${ROLE_LABEL[role] ?? role}`
        : "passou a navegar como outro usuário";
    },
  },
  VIEW_AS_EXIT: {
    category: "acesso",
    severity: "rotina",
    icon: "olho",
    phrase: () => "voltou para a própria conta",
  },

  // Pessoas -----------------------------------------------------------------
  USER_INVITE_CREATE: {
    category: "pessoas",
    severity: "rotina",
    icon: "pessoa",
    phrase: (ctx) => {
      const role = text(ctx.metadata.role);
      const quem = ctx.target ?? "uma pessoa";
      return role
        ? `convidou ${quem} como ${ROLE_LABEL[role] ?? role}`
        : `convidou ${quem}`;
    },
  },
  USER_INVITE_ACCEPT: {
    category: "pessoas",
    severity: "rotina",
    icon: "check",
    phrase: () => "aceitou o convite e criou a conta",
  },
  USER_UPDATE: {
    category: "pessoas",
    severity: "rotina",
    icon: "pessoa",
    phrase: (ctx) =>
      `editou os dados ${ctx.target ? `de ${ctx.target}` : "de um usuário"}`,
  },
  USER_ROLE_CHANGE: {
    category: "pessoas",
    severity: "critico",
    icon: "chave",
    phrase: (ctx) => {
      const role = text(ctx.metadata.newRole);
      const quem = ctx.target ?? "um usuário";
      return role
        ? `tornou ${quem} ${ROLE_LABEL[role] ?? role}`
        : `mudou o nível de acesso de ${quem}`;
    },
  },
  USER_DEACTIVATE: {
    category: "pessoas",
    severity: "atencao",
    icon: "pessoa",
    phrase: (ctx) =>
      `desativou o acesso ${ctx.target ? `de ${ctx.target}` : "de um usuário"}`,
  },
  USER_REACTIVATE: {
    category: "pessoas",
    severity: "rotina",
    icon: "pessoa",
    phrase: (ctx) =>
      `reativou o acesso ${ctx.target ? `de ${ctx.target}` : "de um usuário"}`,
  },
  USER_SOFT_DELETE: {
    category: "pessoas",
    severity: "critico",
    icon: "lixeira",
    phrase: (ctx) =>
      `excluiu a conta ${ctx.target ? `de ${ctx.target}` : "de um usuário"}`,
  },
  USER_PASSWORD_RESET: {
    category: "pessoas",
    severity: "critico",
    icon: "chave",
    phrase: (ctx) =>
      `definiu uma nova senha ${ctx.target ? `para ${ctx.target}` : "para um usuário"}`,
  },

  // Turmas ------------------------------------------------------------------
  COURSE_CREATE: {
    category: "turmas",
    severity: "rotina",
    icon: "turma",
    phrase: (ctx) => `criou ${withName("o", "curso", ctx.target)}`,
  },
  GROUP_CREATE: {
    category: "turmas",
    severity: "rotina",
    icon: "turma",
    phrase: (ctx) => `criou ${withName("a", "turma", ctx.target)}`,
  },
  GROUP_UPDATE: {
    category: "turmas",
    severity: "rotina",
    icon: "turma",
    phrase: (ctx) => {
      const base = `atualizou ${withName("a", "turma", ctx.target)}`;
      if (ctx.metadata.removedScheduleEntry) return `${base} — removeu um horário`;
      if (ctx.metadata.isActive === false)
        return `arquivou ${withName("a", "turma", ctx.target)}`;
      if (ctx.metadata.isActive === true)
        return `reativou ${withName("a", "turma", ctx.target)}`;
      return base;
    },
  },
  ENROLLMENT_CREATE: {
    category: "turmas",
    severity: "rotina",
    icon: "turma",
    phrase: (ctx) => {
      const aluno = named(ctx, "studentId");
      return `matriculou ${aluno ?? "um aluno"} ${ctx.target ? `na turma ${ctx.target}` : "em uma turma"}`;
    },
  },
  ENROLLMENT_CANCEL: {
    category: "turmas",
    severity: "atencao",
    icon: "turma",
    phrase: (ctx) =>
      ctx.target ? `cancelou a matrícula de ${ctx.target}` : "cancelou uma matrícula",
  },
  ENROLLMENT_TRANSFER: {
    category: "turmas",
    severity: "atencao",
    icon: "troca",
    phrase: (ctx) => {
      const aluno = named(ctx, "studentId");
      return `transferiu ${aluno ?? "um aluno"} ${ctx.target ? `para a turma ${ctx.target}` : "de turma"}`;
    },
  },
  GROUP_CHANGE_REQUEST: {
    category: "turmas",
    severity: "atencao",
    icon: "troca",
    phrase: (ctx) =>
      `pediu troca ${ctx.target ? `para a turma ${ctx.target}` : "de turma"}`,
  },

  // Aulas -------------------------------------------------------------------
  SESSION_START: {
    category: "aulas",
    severity: "rotina",
    icon: "aula",
    phrase: (ctx) => `iniciou ${withName("a", "aula", ctx.target)}`,
  },
  SESSION_END: {
    category: "aulas",
    severity: "rotina",
    icon: "aula",
    phrase: (ctx) => `encerrou ${withName("a", "aula", ctx.target)}`,
  },
  ATTENDANCE_RECORD: {
    category: "aulas",
    severity: "rotina",
    icon: "check",
    phrase: (ctx) =>
      ctx.target ? `registrou a chamada da aula ${ctx.target}` : "registrou a chamada",
  },
  ASSIGNMENT_CREATE: {
    category: "aulas",
    severity: "rotina",
    icon: "aula",
    phrase: (ctx) => `criou ${withName("a", "tarefa", ctx.target)}`,
  },
  ASSIGNMENT_SUBMIT: {
    category: "aulas",
    severity: "rotina",
    icon: "aula",
    phrase: (ctx) => `entregou ${withName("a", "tarefa", ctx.target)}`,
  },
  SUBMISSION_GRADE: {
    category: "aulas",
    severity: "rotina",
    icon: "check",
    phrase: (ctx) => {
      const aluno = named(ctx, "studentId");
      const tarefa = ctx.target ? ` da tarefa ${ctx.target}` : "";
      return `corrigiu a entrega${aluno ? ` de ${aluno}` : ""}${tarefa}`;
    },
  },

  // Financeiro --------------------------------------------------------------
  FINANCE_ENTRY_CREATE: {
    category: "financeiro",
    severity: "rotina",
    icon: "dinheiro",
    phrase: (ctx) => {
      const valor = money(ctx.metadata.amount_cents);
      const tipo = ctx.metadata.kind === "expense" ? "uma saída" : "uma entrada";
      return `lançou ${tipo}${valor ? ` de ${valor}` : ""}${ctx.target ? ` — ${ctx.target}` : ""}`;
    },
  },
  FINANCE_ENTRY_UPDATE: {
    category: "financeiro",
    severity: "rotina",
    icon: "dinheiro",
    phrase: (ctx) => {
      const antes = money(ctx.metadata.amount_cents_before);
      const depois = money(ctx.metadata.amount_cents_after);
      const alvo = ctx.target ? ` ${ctx.target}` : "";
      return antes && depois && antes !== depois
        ? `alterou o lançamento${alvo} de ${antes} para ${depois}`
        : `editou o lançamento${alvo}`;
    },
  },
  FINANCE_ENTRY_SETTLE: {
    category: "financeiro",
    severity: "rotina",
    icon: "check",
    phrase: (ctx) => {
      const valor = money(ctx.metadata.amount_cents);
      return `deu baixa no lançamento${ctx.target ? ` ${ctx.target}` : ""}${valor ? ` (${valor})` : ""}`;
    },
  },
  FINANCE_ENTRY_REOPEN: {
    category: "financeiro",
    severity: "atencao",
    icon: "dinheiro",
    phrase: (ctx) =>
      `reabriu o lançamento${ctx.target ? ` ${ctx.target}` : ""} como pendente`,
  },
  FINANCE_ENTRY_DELETE: {
    category: "financeiro",
    severity: "critico",
    icon: "lixeira",
    phrase: (ctx) => {
      const nome = text(ctx.metadata.description) ?? ctx.target;
      const valor = money(ctx.metadata.amount_cents);
      return `excluiu o lançamento${nome ? ` ${nome}` : ""}${valor ? ` (${valor})` : ""}`;
    },
  },
  STUDENT_PLAN_CREATE: {
    category: "financeiro",
    severity: "rotina",
    icon: "dinheiro",
    phrase: (ctx) => {
      const nome = text(ctx.metadata.name) ?? ctx.target;
      const preco = money(ctx.metadata.priceCents);
      return `criou o plano${nome ? ` ${nome}` : ""}${preco ? ` por ${preco}` : ""}`;
    },
  },
  STUDENT_PLAN_UPDATE: {
    category: "financeiro",
    severity: "rotina",
    icon: "dinheiro",
    phrase: (ctx) => {
      const nome = text(ctx.metadata.name) ?? ctx.target;
      return `atualizou o plano${nome ? ` ${nome}` : ""}`;
    },
  },
  STUDENT_PLAN_ACTIVATE: {
    category: "financeiro",
    severity: "rotina",
    icon: "check",
    phrase: (ctx) => `publicou o plano${ctx.target ? ` ${ctx.target}` : ""}`,
  },
  STUDENT_PLAN_ARCHIVE: {
    category: "financeiro",
    severity: "atencao",
    icon: "dinheiro",
    phrase: (ctx) => `arquivou o plano${ctx.target ? ` ${ctx.target}` : ""}`,
  },
  SUBSCRIPTION_CHECKOUT_START: {
    category: "financeiro",
    severity: "rotina",
    icon: "dinheiro",
    phrase: (ctx) => `iniciou a assinatura do plano${ctx.target ? ` ${ctx.target}` : ""}`,
  },
  STRIPE_CONNECT_ONBOARDING: {
    category: "financeiro",
    severity: "atencao",
    icon: "dinheiro",
    phrase: () => "abriu o cadastro da conta de recebimentos",
  },
  STRIPE_CONNECT_SETTINGS_UPDATE: {
    category: "financeiro",
    severity: "atencao",
    icon: "dinheiro",
    phrase: (ctx) => {
      const taxa = ctx.metadata.applicationFeePercent;
      return typeof taxa === "number"
        ? `alterou as regras de cobrança (taxa de ${taxa}%)`
        : "alterou as regras de cobrança";
    },
  },

  // Comunicação -------------------------------------------------------------
  ANNOUNCEMENT_SEND: {
    category: "comunicacao",
    severity: "rotina",
    icon: "mensagem",
    phrase: (ctx) => {
      const total = ctx.metadata.recipients;
      const turma = named(ctx, "groupId");
      const destino = turma ? ` da turma ${turma}` : "";
      return typeof total === "number"
        ? `enviou um comunicado para ${total} ${total === 1 ? "pessoa" : "pessoas"}${destino}`
        : `enviou um comunicado${destino || " para a escola"}`;
    },
  },
  "chat.students_muted": {
    category: "comunicacao",
    severity: "atencao",
    icon: "mensagem",
    phrase: (ctx) =>
      `silenciou os alunos na conversa${ctx.target ? ` ${ctx.target}` : " da turma"}`,
  },
  "chat.students_unmuted": {
    category: "comunicacao",
    severity: "rotina",
    icon: "mensagem",
    phrase: (ctx) =>
      `liberou os alunos para escrever na conversa${ctx.target ? ` ${ctx.target}` : " da turma"}`,
  },

  // Privacidade -------------------------------------------------------------
  LGPD_DELETION_REQUESTED: {
    category: "privacidade",
    severity: "critico",
    icon: "privacidade",
    phrase: () => "pediu a exclusão dos próprios dados (LGPD)",
  },
};

/** Verbos usados quando a ação é nova e ainda não está no catálogo. */
const FALLBACK_VERBS: Record<string, string> = {
  CREATE: "criou",
  UPDATE: "atualizou",
  DELETE: "excluiu",
  SEND: "enviou",
  START: "iniciou",
  END: "encerrou",
  CANCEL: "cancelou",
  ACCEPT: "aceitou",
  RECORD: "registrou",
  SUBMIT: "enviou",
};

/** Substantivo do alvo, indefinido (sem nome) e definido (com nome). */
const FALLBACK_NOUNS: Record<string, { vago: string; nomeado: string }> = {
  profile: { vago: "um cadastro", nomeado: "o cadastro de" },
  group: { vago: "uma turma", nomeado: "a turma" },
  course: { vago: "um curso", nomeado: "o curso" },
  finance_entry: { vago: "um lançamento", nomeado: "o lançamento" },
  student_plan: { vago: "um plano", nomeado: "o plano" },
  assignment: { vago: "uma tarefa", nomeado: "a tarefa" },
  class_session: { vago: "uma aula", nomeado: "a aula" },
  conversation: { vago: "uma conversa", nomeado: "a conversa" },
  user_invite: { vago: "um convite", nomeado: "o convite de" },
  stripe_account: {
    vago: "a conta de recebimentos",
    nomeado: "a conta de recebimentos",
  },
};

export interface AuditDescription {
  /** A frase completa, com o autor na frente. */
  sentence: string;
  /** Só a oração, sem o autor — usada quando o autor já aparece na coluna. */
  phrase: string;
  actor: string;
  category: AuditCategory;
  severity: AuditSeverity;
  icon: AuditIconName;
}

/**
 * A ação técnica vira frase. Ações desconhecidas caem num molde genérico em
 * vez de vazar o identificador cru — a tela nunca mostra `FOO_BAR_CREATE`.
 */
export function describe(entry: AuditLogEntry): AuditDescription {
  const ctx: PhraseContext = {
    target: entry.entityLabel,
    metadata: entry.metadata,
    references: entry.references,
  };

  const descriptor = CATALOG[entry.action];
  const actor = entry.actorName ?? roleLabel(entry.actorRole);

  if (descriptor) {
    const phrase = descriptor.phrase(ctx);
    return {
      phrase,
      sentence: `${actor} ${phrase}`,
      actor,
      category: descriptor.category,
      severity: descriptor.severity,
      icon: descriptor.icon,
    };
  }

  const verb = FALLBACK_VERBS[entry.action.split("_").pop() ?? ""] ?? "mexeu em";
  const noun = (entry.entityType ? FALLBACK_NOUNS[entry.entityType] : null) ?? {
    vago: "um registro",
    nomeado: "o registro",
  };
  const phrase = entry.entityLabel
    ? `${verb} ${noun.nomeado} ${entry.entityLabel}`
    : `${verb} ${noun.vago}`;

  return {
    phrase,
    sentence: `${actor} ${phrase}`,
    actor,
    category: guessCategory(entry.entityType),
    severity: "rotina",
    icon: "check",
  };
}

function guessCategory(entityType: string | null): AuditCategory {
  switch (entityType) {
    case "profile":
    case "user_invite":
      return "pessoas";
    case "group":
    case "course":
      return "turmas";
    case "assignment":
    case "class_session":
      return "aulas";
    case "finance_entry":
    case "student_plan":
    case "stripe_account":
      return "financeiro";
    case "conversation":
      return "comunicacao";
    default:
      return "acesso";
  }
}

// ---------------------------------------------------------------------------
// Detalhes (o que o metadata guarda)
// ---------------------------------------------------------------------------

const FIELD_LABEL: Record<string, string> = {
  role: "Papel",
  newRole: "Novo papel",
  phone: "Telefone",
  studentId: "Aluno",
  enrollmentId: "Matrícula",
  groupId: "Turma",
  fromGroupId: "Turma anterior",
  isActive: "Ativa",
  scope: "Alcance",
  recipients: "Destinatários",
  kind: "Tipo",
  category: "Categoria",
  status: "Situação",
  status_after: "Nova situação",
  amount_cents: "Valor",
  amount_cents_before: "Valor anterior",
  amount_cents_after: "Novo valor",
  description: "Descrição",
  occurred_on: "Competência",
  name: "Nome",
  priceCents: "Preço",
  chargeModel: "Modelo de cobrança",
  applicationFeePercent: "Taxa da escola",
  removedScheduleEntry: "Horário removido",
  direction: "Tipo",
};

const VALUE_LABEL: Record<string, string> = {
  income: "Entrada",
  expense: "Saída",
  paid: "Pago",
  pending: "Pendente",
  overdue: "Vencido",
  canceled: "Cancelado",
  all: "Toda a escola",
  group: "Uma turma",
  admin: "Administrador",
  teacher: "Professor",
  student: "Aluno",
  direct: "Cobrança direta",
  platform: "Cobrança pela escola",
};

const MONEY_FIELDS = new Set([
  "amount_cents",
  "amount_cents_before",
  "amount_cents_after",
  "priceCents",
  "price_cents",
]);

export interface AuditDetail {
  label: string;
  value: string;
}

/** Metadata em pares "rótulo: valor" legíveis; ids viram nomes quando dá. */
export function detailsOf(entry: AuditLogEntry): AuditDetail[] {
  const details: AuditDetail[] = [];

  for (const [key, raw] of Object.entries(entry.metadata)) {
    if (raw === null || raw === undefined || raw === "") continue;

    const label = FIELD_LABEL[key] ?? humanizeKey(key);
    let value: string;

    if (MONEY_FIELDS.has(key) && typeof raw === "number") {
      value = formatMoney(raw);
    } else if (typeof raw === "boolean") {
      value = raw ? "Sim" : "Não";
    } else if (typeof raw === "number") {
      value = new Intl.NumberFormat("pt-BR").format(raw);
    } else if (typeof raw === "string") {
      value =
        entry.references[raw] ??
        VALUE_LABEL[raw] ??
        (isIsoDate(raw) ? formatDateOnly(raw) : raw);
    } else {
      // Objetos (ex.: horário removido) viram uma linha compacta e legível.
      value = Object.entries(raw as Record<string, unknown>)
        .map(([k, v]) => `${humanizeKey(k)}: ${String(v)}`)
        .join(" · ");
    }

    details.push({ label, value });
  }

  if (entry.actorEmail) details.push({ label: "Conta", value: entry.actorEmail });

  return details;
}

function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T|$)/.test(value);
}

function formatDateOnly(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/** Chave de agrupamento por dia local (não UTC — o log é lido em Brasília). */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function dayTitle(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000).toISOString());
  const key = dayKey(iso);

  if (key === today) return "Hoje";
  if (key === yesterday) return "Ontem";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "agora há pouco", "há 3 h", "há 5 dias" — o suficiente para dar noção. */
export function relativeTime(iso: string, now = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);

  if (minutes < 1) return "agora há pouco";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;

  const months = Math.round(days / 30);
  return `há ${months} ${months === 1 ? "mês" : "meses"}`;
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export type PeriodFilter = "hoje" | "7d" | "30d" | "tudo";

export const PERIOD_LABEL: Record<PeriodFilter, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  tudo: "Tudo",
};

export function withinPeriod(
  iso: string,
  period: PeriodFilter,
  now = new Date(),
): boolean {
  if (period === "tudo") return true;
  if (period === "hoje") return dayKey(iso) === dayKey(now.toISOString());
  const days = period === "7d" ? 7 : 30;
  return now.getTime() - new Date(iso).getTime() <= days * 86_400_000;
}

/**
 * Busca sobre o texto que o admin vê — a frase pronta, o autor e os
 * detalhes. Ninguém procura por "FINANCE_ENTRY_SETTLE"; procura por "Maria"
 * ou "mensalidade".
 */
export function matches(entry: AuditLogEntry, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return true;

  const { sentence } = describe(entry);
  const haystack = [
    sentence,
    entry.actorName ?? "",
    entry.actorEmail ?? "",
    entry.entityLabel ?? "",
    roleLabel(entry.actorRole),
    ...detailsOf(entry).map((detail) => `${detail.label} ${detail.value}`),
  ]
    .join(" ")
    .toLowerCase();

  return needle.split(/\s+/).every((word) => haystack.includes(word));
}
