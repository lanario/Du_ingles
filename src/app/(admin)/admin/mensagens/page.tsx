import type { Metadata } from "next";
import { listGroups } from "@/repositories/groups";
import { AnnouncementForm } from "@/components/features/admin/announcement-form";

export const metadata: Metadata = { title: "Mensagens" };

export default async function AdminMensagensPage() {
  const groups = await listGroups();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Comunicados</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Envia uma notificação para toda a escola ou para uma turma específica.
      </p>
      <div className="mt-8">
        <AnnouncementForm groups={groups} />
      </div>
    </div>
  );
}
