import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getAgenda } from "@/repositories/agenda";
import { AgendaView } from "@/components/features/agenda/agenda-view";

export const metadata: Metadata = { title: "Agenda" };

/**
 * Agenda da coordenação: a escola inteira, sem teto (§3.3). Todas as aulas
 * de todas as turmas, os compromissos de qualquer turma e os que valem para
 * a escola — com direito a editar e excluir tudo.
 *
 * O recorte por papel mora no repositório, não aqui: `getAgenda` recebe o
 * contexto e devolve cada item já marcado com o que este usuário pode fazer
 * com ele.
 */
export default async function AdminAgendaPage() {
  const ctx = await requireRole(["admin"]);
  const agenda = await getAgenda(ctx);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <p className="mt-1 text-sm text-admin-foreground/70">
          Aulas, reuniões, provas e eventos de todas as turmas.
        </p>
      </header>

      <AgendaView initial={agenda} area="admin" />
    </div>
  );
}
