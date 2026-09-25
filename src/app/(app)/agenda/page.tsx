import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { GoogleConnect } from "@/components/features/google/google-connect";
import { googleStatus } from "@/lib/google/connection";
import { queueBackfill } from "@/lib/google/sync";
import { getAgenda } from "@/repositories/agenda";
import { AgendaView } from "@/components/features/agenda/agenda-view";

export const metadata: Metadata = { title: "Agenda" };

/**
 * Agenda do aluno: leitura, e só.
 *
 * Ele vê as aulas das turmas em que está matriculado — incluindo as que a
 * grade prevê e ninguém marcou ainda, que aparecem pontilhadas — e os
 * compromissos da turma e da escola que não são assunto interno da equipe.
 * Aula cancelada não aparece para ele: o compromisso deixou de existir, e um
 * cartão riscado só geraria dúvida sobre se tem aula.
 *
 * Não existe action de escrita alcançável daqui: `canCreateEvent` vem falso
 * do repositório, nenhum item vem com `canEdit`, e as actions de escrita
 * exigem `requireStaff`. As três camadas dizem a mesma coisa.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const ctx = await requireRole(["student"]);
  const { google } = await searchParams;
  const [agenda, googleState] = await Promise.all([
    getAgenda(ctx),
    googleStatus(ctx.userId),
  ]);
  // Aulas que o banco gerou sozinho ainda não estão na agenda Google: manda agora.
  if (googleState.connected) queueBackfill(ctx.userId, ctx.realRole);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Agenda</h1>
      </header>

      <GoogleConnect status={googleState} notice={google} />

      <AgendaView initial={agenda} area="app" />
    </div>
  );
}
