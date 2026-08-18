import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Termos de uso</h1>
      <div className="prose prose-sm mt-8 max-w-none space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Ao utilizar a plataforma Du Inglês, alunos, professores e responsáveis concordam
          com as condições descritas neste documento.
        </p>
        <h2 className="font-semibold text-foreground">Acesso à plataforma</h2>
        <p>
          O acesso é individual e intransferível, concedido pela administração da escola.
          Não há autocadastro — contas são criadas e desativadas exclusivamente pela
          equipe administrativa.
        </p>
        <h2 className="font-semibold text-foreground">Conteúdo das aulas</h2>
        <p>
          O material gerado em cada aula (PDF, glossário, tarefas) é de uso pessoal do
          aluno matriculado na turma correspondente, vedada a redistribuição.
        </p>
        <h2 className="font-semibold text-foreground">Cancelamento</h2>
        <p>
          Planos podem ser cancelados a qualquer momento mediante contato com a
          coordenação, sem multa por fidelidade nos planos mensais.
        </p>
      </div>
    </div>
  );
}
