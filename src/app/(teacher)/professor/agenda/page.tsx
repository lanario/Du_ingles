import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getAgenda } from "@/repositories/agenda";
import { AgendaView } from "@/components/features/agenda/agenda-view";

export const metadata: Metadata = { title: "Agenda" };

/**
 * Agenda do professor: as turmas dele, as aulas que ele dá (inclusive em
 * substituição, onde o corte é `class_sessions.teacher_id`) e o que a escola
 * marcou para todo mundo. Ele edita o que é da própria turma — nunca o
 * compromisso da escola inteira, que é decisão de coordenação.
 *
 * Quem aplica essa regra é `repositories/agenda.ts` na leitura e
 * `actions/admin/agenda.ts` na escrita. Esta página só escolhe o papel.
 */
export default async function ProfessorAgendaPage() {
  const ctx = await requireRole(["teacher"]);
  const agenda = await getAgenda(ctx);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <p className="mt-1 text-sm text-admin-foreground/70">
          Suas aulas, os compromissos das suas turmas e o que a escola marcou.
        </p>
      </header>

      <AgendaView initial={agenda} area="admin" />
    </div>
  );
}
