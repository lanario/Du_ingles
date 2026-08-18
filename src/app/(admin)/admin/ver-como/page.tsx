import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listUsers } from "@/repositories/users";
import { enterViewAsModeAction } from "@/actions/admin/view-as";

export const metadata: Metadata = { title: "Ver como Professor" };

export default async function VerComoPage() {
  const ctx = await requireRole(["admin"]);
  const teachers = await listUsers(ctx.organizationId, { role: "teacher" });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Ver como Professor</h1>
      <p className="mt-1 max-w-xl text-sm text-admin-foreground/70">
        Entra em modo somente leitura, vendo exatamente o que o professor escolhido vê.
        Nenhuma escrita é permitida nesse modo, e a ação fica registrada na auditoria.
      </p>

      {teachers.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-admin-border p-10 text-center text-admin-foreground/70">
          Nenhum professor ativo cadastrado ainda.
        </p>
      ) : (
        <ul className="mt-6 max-w-md divide-y divide-admin-border rounded-lg border border-admin-border">
          {teachers.map((teacher) => (
            <li key={teacher.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{teacher.fullName}</p>
                <p className="text-xs text-admin-foreground/60">{teacher.email}</p>
              </div>
              <form action={enterViewAsModeAction}>
                <input type="hidden" name="targetTeacherId" value={teacher.id} />
                <button
                  type="submit"
                  className="rounded-md bg-admin-accent px-3 py-1.5 text-sm font-medium text-admin-accent-foreground hover:opacity-90"
                >
                  Ver como
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
