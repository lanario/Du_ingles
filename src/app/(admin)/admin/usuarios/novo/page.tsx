import type { Metadata } from "next";
import { CreateUserForm } from "@/components/features/admin/users/create-user-form";

export const metadata: Metadata = { title: "Novo usuário" };

export default function NovoUsuarioPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Novo usuário</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Uma senha temporária é gerada automaticamente. O usuário será obrigado a trocá-la
        no primeiro acesso.
      </p>
      <div className="mt-8">
        <CreateUserForm />
      </div>
    </div>
  );
}
