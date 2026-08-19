import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface AuditLogEntry {
  id: number;
  action: string;
  actorId: string | null;
  /** Nome de quem agiu — resolvido em `profiles`; nulo se a conta sumiu. */
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  entityType: string | null;
  entityId: string | null;
  /** Nome legível do alvo (turma, aluno, lançamento…), quando existe. */
  entityLabel: string | null;
  metadata: Record<string, unknown>;
  /** id → nome, para os ids que aparecem dentro de `metadata`. */
  references: Record<string, string>;
  createdAt: string;
}

/** Tabelas consultadas para dar nome aos ids do log. */
type LabelTable =
  | "profiles"
  | "groups"
  | "courses"
  | "finance_entries"
  | "student_plans"
  | "assignments"
  | "class_sessions"
  | "conversations"
  | "user_invites";

/**
 * Tabela que dá nome a cada `entity_type` gravado pelo `auditLog`. Sem isso a
 * tela mostraria um uuid picotado — que não diz nada a quem lê.
 */
const ENTITY_SOURCES: Record<string, LabelTable> = {
  profile: "profiles",
  group: "groups",
  course: "courses",
  finance_entry: "finance_entries",
  student_plan: "student_plans",
  assignment: "assignments",
  class_session: "class_sessions",
  conversation: "conversations",
  user_invite: "user_invites",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ids soltos dentro do metadata (`studentId`, `enrollmentId`, …). */
function collectMetadataIds(metadata: Record<string, unknown>): string[] {
  return Object.values(metadata).filter(
    (value): value is string => typeof value === "string" && UUID_RE.test(value),
  );
}

/**
 * Busca `id → rótulo` numa tabela, sempre presa à organização do admin.
 * Uma consulta por tabela, nunca uma por linha do log.
 *
 * O `switch` existe para manter a tipagem do Supabase: passar o nome da
 * tabela como variável apaga os tipos gerados e devolve `any` na cadeia toda.
 */
async function fetchLabels(
  table: LabelTable,
  ids: string[],
  organizationId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const admin = createAdminSupabaseClient();
  const scoped = <T>(rows: T[] | null) => rows ?? [];

  const collect = (rows: Array<{ id: string; label: string | null }>) => {
    for (const row of rows) {
      if (row.label && row.label.trim() !== "") map.set(row.id, row.label);
    }
    return map;
  };

  switch (table) {
    case "profiles": {
      const { data } = await admin
        .from("profiles")
        .select("id, full_name")
        .eq("organization_id", organizationId)
        .in("id", ids);
      return collect(scoped(data).map((r) => ({ id: r.id, label: r.full_name })));
    }
    case "groups": {
      const { data } = await admin
        .from("groups")
        .select("id, name")
        .eq("organization_id", organizationId)
        .in("id", ids);
      return collect(scoped(data).map((r) => ({ id: r.id, label: r.name })));
    }
    case "courses": {
      const { data } = await admin
        .from("courses")
        .select("id, name")
        .eq("organization_id", organizationId)
        .in("id", ids);
      return collect(scoped(data).map((r) => ({ id: r.id, label: r.name })));
    }
    case "finance_entries": {
      const { data } = await admin
        .from("finance_entries")
        .select("id, description")
        .eq("organization_id", organizationId)
        .in("id", ids);
      return collect(scoped(data).map((r) => ({ id: r.id, label: r.description })));
    }
    case "student_plans": {
      const { data } = await admin
        .from("student_plans")
        .select("id, name")
        .eq("organization_id", organizationId)
        .in("id", ids);
      return collect(scoped(data).map((r) => ({ id: r.id, label: r.name })));
    }
    case "assignments": {
      const { data } = await admin
        .from("assignments")
        .select("id, title")
        .eq("organization_id", organizationId)
        .in("id", ids);
      return collect(scoped(data).map((r) => ({ id: r.id, label: r.title })));
    }
    case "class_sessions": {
      const { data } = await admin
        .from("class_sessions")
        .select("id, title")
        .eq("organization_id", organizationId)
        .in("id", ids);
      return collect(scoped(data).map((r) => ({ id: r.id, label: r.title })));
    }
    case "conversations": {
      const { data } = await admin
        .from("conversations")
        .select("id, title")
        .eq("organization_id", organizationId)
        .in("id", ids);
      return collect(scoped(data).map((r) => ({ id: r.id, label: r.title })));
    }
    case "user_invites": {
      const { data } = await admin
        .from("user_invites")
        .select("id, full_name")
        .eq("organization_id", organizationId)
        .in("id", ids);
      return collect(scoped(data).map((r) => ({ id: r.id, label: r.full_name })));
    }
  }
}

/**
 * Últimos registros de auditoria, já com nomes no lugar dos ids.
 *
 * A leitura do log passa pela RLS normal (`audit_logs_select_admin`); só a
 * resolução dos nomes usa service-role, porque o alvo pode ser uma conta
 * desativada ou apagada — cujo rastro precisa continuar legível — e a busca
 * é sempre limitada à organização recebida.
 */
export async function listAuditLogs(
  organizationId: string,
  limit = 200,
): Promise<AuditLogEntry[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, actor_id, actor_role, entity_type, entity_id, metadata, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const rows = data.map((row) => ({
    ...row,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
  }));

  // Um balde de ids por tabela — os ids soltos do metadata entram como
  // possíveis pessoas ou turmas, que é o que aparece na prática.
  const byTable = new Map<LabelTable, Set<string>>();
  const push = (table: LabelTable, id: string | null | undefined) => {
    if (!id) return;
    const set = byTable.get(table) ?? new Set<string>();
    set.add(id);
    byTable.set(table, set);
  };

  for (const row of rows) {
    push("profiles", row.actor_id);
    const source = row.entity_type ? ENTITY_SOURCES[row.entity_type] : undefined;
    if (source) push(source, row.entity_id);
    for (const id of collectMetadataIds(row.metadata)) {
      push("profiles", id);
      push("groups", id);
    }
  }

  const tables = [...byTable.entries()];
  const results = await Promise.all(
    tables.map(([table, ids]) => fetchLabels(table, [...ids], organizationId)),
  );
  const labels = new Map(tables.map(([table], index) => [table, results[index]]));

  // E-mail do ator vem junto para diferenciar dois homônimos.
  const actorIds = [...(byTable.get("profiles") ?? [])];
  const emails = new Map<string, string>();
  if (actorIds.length > 0) {
    const admin = createAdminSupabaseClient();
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .eq("organization_id", organizationId)
      .in("id", actorIds);
    for (const profile of profiles ?? []) emails.set(profile.id, profile.email);
  }

  return rows.map((row) => {
    const source = row.entity_type ? ENTITY_SOURCES[row.entity_type] : undefined;
    const entityLabel =
      source && row.entity_id ? (labels.get(source)?.get(row.entity_id) ?? null) : null;

    const references: Record<string, string> = {};
    for (const id of collectMetadataIds(row.metadata)) {
      const name = labels.get("profiles")?.get(id) ?? labels.get("groups")?.get(id);
      if (name) references[id] = name;
    }

    return {
      id: row.id,
      action: row.action,
      actorId: row.actor_id,
      actorName: row.actor_id
        ? (labels.get("profiles")?.get(row.actor_id) ?? null)
        : null,
      actorEmail: row.actor_id ? (emails.get(row.actor_id) ?? null) : null,
      actorRole: row.actor_role,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityLabel,
      metadata: row.metadata,
      references,
      createdAt: row.created_at,
    };
  });
}
