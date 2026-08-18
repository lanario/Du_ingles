import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { listUsers } from "@/repositories/users";
import { RoleBadge } from "@/components/features/admin/users/role-badge";
import { StatusBadge } from "@/components/features/admin/users/status-badge";
import type { AppRole } from "@/types/domain";

export const metadata: Metadata = { title: "Usuários" };

const ROLE_FILTERS: { value: AppRole | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "admin", label: "Admins" },
  { value: "teacher", label: "Professores" },
  { value: "student", label: "Alunos" },
];

interface PageProps {
  searchParams: Promise<{ role?: string; search?: string }>;
}

export default async function UsuariosPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin"]);
  const params = await searchParams;
  const role = (params.role as AppRole | undefined) || undefined;

  const users = await listUsers(ctx.organizationId, {
    role,
    search: params.search,
    includeInactive: true,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <Link
          href="/admin/usuarios/novo"
          className="rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-admin-accent-foreground hover:opacity-90"
        >
          Novo usuário
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        {ROLE_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/usuarios?role=${f.value}` : "/admin/usuarios"}
            className={
              (role ?? "") === f.value
                ? "rounded-full bg-admin-accent px-3 py-1 text-xs font-medium text-admin-accent-foreground"
                : "rounded-full border border-admin-border px-3 py-1 text-xs text-admin-foreground/70 hover:bg-admin-muted"
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      {users.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-admin-border p-10 text-center">
          <p className="text-admin-foreground/70">Nenhum usuário encontrado.</p>
          <Link
            href="/admin/usuarios/novo"
            className="mt-3 inline-block text-admin-accent hover:underline"
          >
            Criar o primeiro usuário
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-admin-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border text-left text-admin-foreground/60">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-admin-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/usuarios/${user.id}`} className="hover:underline">
                      {user.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-admin-foreground/70">{user.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge isActive={user.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
