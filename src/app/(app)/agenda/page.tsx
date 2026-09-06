import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
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
export default async function AgendaPage() {
  const ctx = await requireRole(["student"]);
  const agenda = await getAgenda(ctx);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suas aulas, provas e o que a escola marcou.
        </p>
      </header>

      <AgendaView initial={agenda} area="app" />
    </div>
  );
}
