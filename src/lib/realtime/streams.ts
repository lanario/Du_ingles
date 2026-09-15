/**
 * Catálogo do tempo real.
 *
 * Cada *stream* é um assunto da escola ("a agenda", "as tarefas") e aponta
 * para as tabelas cuja escrita muda o que aquela tela mostra. As telas pedem
 * o assunto, não a tabela: quando uma feature ganhar uma tabela nova, é aqui
 * que ela entra — nenhuma página precisa ser tocada de novo.
 *
 * Só entra aqui tabela que esteja na publicação `supabase_realtime` E com RLS
 * ligada (migration 0041). Sem RLS o payload de `postgres_changes` vazaria a
 * linha inteira para qualquer assinante autenticado; a migration se recusa a
 * publicar nesse caso, então uma tabela esquecida aqui vira "não atualiza
 * sozinha", nunca "vaza".
 *
 * O consumo é sempre via `<LiveRefresh>`: o evento não carrega dado para a
 * tela, ele só dispara `router.refresh()`. Quem decide o que cada usuário vê
 * continua sendo o servidor, com a autorização que as páginas já fazem.
 */
export const LIVE_TABLES = {
  /**
   * Aula marcada, iniciada, encerrada, chamada feita.
   *
   * `session_content_versions` fica de fora de propósito: é um snapshot que a
   * sala ao vivo grava de 5 em 5 minutos para poder voltar atrás, e tela
   * nenhuma desenha essas versões. Publicá-la aqui faria a escola inteira
   * revalidar a cada 5 minutos por causa de um backup interno.
   */
  aulas: ["class_sessions", "attendance"],
  /** Calendário: aula, evento avulso e a grade da turma que projeta prévias. */
  agenda: ["class_sessions", "agenda_events", "groups"],
  /** Tarefa criada/editada, entrega enviada, correção fechada. */
  tarefas: ["assignments", "assignment_submissions"],
  /** Turma criada/editada e matrícula entrando ou saindo. */
  turmas: ["groups", "enrollments"],
  /** Planejador: planos, pastas e modelos de tarefa (com as pastas deles). */
  planejador: [
    "lesson_plans",
    "lesson_plan_folders",
    "assignment_templates",
    "assignment_template_folders",
  ],
  /** Cadastro de gente: perfil, matrícula e convite pendente. */
  pessoas: ["profiles", "enrollments", "user_invites"],
  /** Catálogo de planos e a assinatura de cada aluno. */
  planos: ["student_plans", "student_subscriptions"],
  /** Financeiro: lançamentos e o que a assinatura gera. */
  financeiro: ["finance_entries", "student_subscriptions"],
  /** Lista de conversas (o corpo do chat tem realtime próprio). */
  conversas: ["conversations"],
} as const satisfies Record<string, readonly string[]>;

export type LiveStream = keyof typeof LIVE_TABLES;

/** Tabelas de um conjunto de assuntos, sem repetição e em ordem estável. */
export function tablesFor(streams: readonly LiveStream[]): string[] {
  const tables = new Set<string>();
  for (const stream of streams)
    for (const table of LIVE_TABLES[stream]) tables.add(table);
  return [...tables].sort();
}

/**
 * Que assunto cada tela escuta.
 *
 * O mapa vive aqui, e não espalhado em cada `page.tsx`, porque `<LiveRefresh>`
 * é montado UMA vez por área (nos três layouts) e descobre a rota sozinho —
 * página nova nasce em tempo real só de entrar nesta tabela, sem mexer no JSX
 * de ninguém. Rota fora do mapa simplesmente não assina nada.
 *
 * A chave casa por segmento: `/planos` não pega `/planos-de-aula`. Quando duas
 * chaves servem, vence a mais específica (`/admin/planejador/tarefa` antes de
 * `/admin/planejador`).
 */
const ROUTE_STREAMS: Record<string, readonly LiveStream[]> = {
  // ------------------------------------------------------------- aluno ----
  "/dashboard": ["aulas", "tarefas", "turmas", "agenda"],
  "/agenda": ["agenda", "turmas"],
  "/tarefas": ["tarefas", "turmas"],
  "/turmas": ["turmas", "pessoas"],
  "/aula": ["aulas", "turmas", "tarefas"],
  "/progresso": ["aulas", "tarefas", "turmas"],
  "/biblioteca": ["aulas", "turmas"],
  "/planos-de-aula": ["planejador", "turmas"],
  "/planos": ["planos"],
  "/mensagens": ["conversas", "turmas"],
  "/meus-dados": ["pessoas"],

  // --------------------------------------------------------- professor ----
  "/professor": ["aulas", "tarefas", "turmas", "agenda"],
  "/professor/agenda": ["agenda", "turmas"],
  "/professor/alunos": ["pessoas", "turmas"],
  "/professor/turmas": ["turmas", "pessoas", "aulas", "tarefas"],
  "/professor/planejador": ["planejador", "turmas"],
  "/professor/planejador/aula": ["planejador", "aulas", "turmas", "tarefas"],
  "/professor/planejador/tarefa": ["planejador", "tarefas", "turmas"],
  "/professor/mensagens": ["conversas", "turmas"],
  "/professor/meus-dados": ["pessoas"],

  // ------------------------------------------------------------- admin ----
  "/admin": ["aulas", "tarefas", "turmas", "pessoas", "financeiro"],
  "/admin/agenda": ["agenda", "turmas"],
  "/admin/alunos": ["pessoas", "turmas", "planos"],
  "/admin/turmas": ["turmas", "pessoas", "aulas", "tarefas"],
  "/admin/usuarios": ["pessoas"],
  "/admin/planejador": ["planejador", "turmas"],
  "/admin/planejador/aula": ["planejador", "aulas", "turmas", "tarefas"],
  "/admin/planejador/tarefa": ["planejador", "tarefas", "turmas"],
  "/admin/planos-de-alunos": ["planos", "pessoas"],
  "/admin/financeiro": ["financeiro", "planos", "pessoas"],
  "/admin/relatorios": ["aulas", "tarefas", "turmas", "pessoas"],
  "/admin/mensagens": ["conversas", "turmas"],
  "/admin/meus-dados": ["pessoas"],
};

/** Chaves da mais específica para a mais genérica — a primeira que casa vale. */
const ROUTE_KEYS = Object.keys(ROUTE_STREAMS).sort((a, b) => b.length - a.length);

export function streamsForPath(pathname: string): readonly LiveStream[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const match = ROUTE_KEYS.find((key) => path === key || path.startsWith(`${key}/`));
  return (match && ROUTE_STREAMS[match]) || [];
}

/**
 * Colunas que identificam quem ESCREVEU a linha, nas duas tabelas que têm
 * salvamento automático.
 *
 * Sem isso o autosave morde a própria cauda: o aluno digita a resposta, o
 * rascunho vai para `assignment_submissions` a cada segundo, o evento volta
 * para a mesma aba e a página se revalida no meio da digitação. O mesmo vale
 * para o autosave do planejador (`lesson_plans`).
 *
 * De fora ficam de propósito `class_sessions` e `agenda_events`: ali as
 * colunas de gente (`teacher_id`, `created_by`) dizem de QUEM é a aula, não
 * quem acabou de mexer nela — a secretaria remarcando o horário do professor
 * escreve uma linha que continua com o nome dele. Filtrar por elas esconderia
 * exatamente a mudança que mais importa ver na hora.
 */
const WRITER_COLUMNS: Record<string, readonly string[]> = {
  assignment_submissions: ["student_id", "graded_by"],
  lesson_plans: ["author_id"],
};

/**
 * A linha que chegou foi escrita pelo próprio usuário?
 *
 * Verdadeiro só quando TODAS as colunas de autoria preenchidas apontam para
 * ele. É o que separa "meu rascunho salvando sozinho" (student_id = eu,
 * graded_by vazio → ignorar) de "o professor fechou a minha correção"
 * (student_id = eu, graded_by = o professor → revalidar).
 */
export function isSelfWrite(table: string, row: unknown, userId: string): boolean {
  const columns = WRITER_COLUMNS[table];
  if (!columns || !row || typeof row !== "object") return false;

  let matched = false;
  for (const column of columns) {
    const value = (row as Record<string, unknown>)[column];
    if (value === null || value === undefined) continue;
    if (value !== userId) return false;
    matched = true;
  }
  return matched;
}
