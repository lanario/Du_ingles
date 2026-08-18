import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserById } from "@/repositories/users";
import { RoleBadge } from "@/components/features/admin/users/role-badge";
import { StatusBadge } from "@/components/features/admin/users/status-badge";
import { EditUserForm } from "@/components/features/admin/users/edit-user-form";
import { UserLifecycleActions } from "@/components/features/admin/users/user-lifecycle-actions";
import { ChangeRoleForm } from "@/components/features/admin/users/change-role-form";

export const metadata: Metadata = { title: "Usuário" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UsuarioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{user.fullName}</h1>
          <RoleBadge role={user.role} />
          <StatusBadge isActive={user.isActive} />
        </div>
        <p className="mt-1 text-sm text-admin-foreground/70">{user.email}</p>
        {user.deletedAt && (
          <p className="mt-1 text-sm text-destructive">
            Excluído em {new Date(user.deletedAt).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-foreground/60">
          Ações
        </h2>
        <UserLifecycleActions user={user} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-foreground/60">
          Papel
        </h2>
        <ChangeRoleForm userId={user.id} currentRole={user.role} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-foreground/60">
          Dados
        </h2>
        <EditUserForm user={user} />
      </section>
    </div>
  );
}
