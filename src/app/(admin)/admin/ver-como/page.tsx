import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listUsers, type UserListItem } from "@/repositories/users";
import { enterViewAsModeAction } from "@/actions/admin/view-as";
import { ContextSwitcher } from "@/components/features/admin/context-switcher";

export const metadata: Metadata = { title: "Ver como" };

/**
 * Pré-visualização da área do aluno. O professor saiu daqui: ele tem área
 * própria (`/professor`) e papel próprio — não é um contexto que o admin
 * veste.
 */
export default async function VerComoPage() {
  const ctx = await requireRole(["admin"]);
  const students = await listUsers(ctx.organizationId, { role: "student" });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Ver como</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-admin-foreground/65">
        Abre a área do aluno em modo somente leitura, para conferir exatamente o layout
        que ele enxerga. Nenhuma escrita é permitida nesse modo, e a entrada e a saída
        ficam registradas na auditoria.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-admin-border bg-admin-surface p-4">
        <span className="text-sm text-admin-foreground/70">
          Trocar de contexto agora:
        </span>
        <ContextSwitcher current="admin" variant="banner" />
      </div>

      <div className="mt-8">
        <StudentColumn users={students} />
      </div>
    </div>
  );
}

function StudentColumn({ users }: { users: UserListItem[] }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-admin-foreground">Alunos</h2>
          <p className="text-xs text-admin-foreground/55">Entra na área do aluno.</p>
        </div>
        <span className="rounded-full bg-admin-muted px-2 py-0.5 text-xs tabular text-admin-foreground/60">
          {users.length}
        </span>
      </div>

      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-admin-border p-8 text-center text-sm text-admin-foreground/50">
          Nenhum aluno ativo cadastrado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-admin-border rounded-xl border border-admin-border bg-admin-surface">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.fullName}</p>
                <p className="truncate text-xs text-admin-foreground/55">{user.email}</p>
              </div>
              <form action={enterViewAsModeAction} className="flex-none">
                <input type="hidden" name="role" value="student" />
                <input type="hidden" name="targetUserId" value={user.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-navy-900 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Ver como
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
