import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { GoogleConnect } from "@/components/features/google/google-connect";
import { googleStatus } from "@/lib/google/connection";
import { queueBackfill } from "@/lib/google/sync";
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
export default async function AdminAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const ctx = await requireRole(["admin"]);
  const { google } = await searchParams;
  const [agenda, googleState] = await Promise.all([
    getAgenda(ctx),
    googleStatus(ctx.userId),
  ]);
  // Aulas que o banco gerou sozinho ainda não estão na agenda Google: manda agora.
  if (googleState.connected) queueBackfill(ctx.userId, ctx.realRole);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <GoogleConnect
          status={googleState}
          notice={google}
          showDescription={false}
          className="ml-auto items-end"
        />
      </header>

      <AgendaView initial={agenda} area="admin" />
    </div>
  );
}
