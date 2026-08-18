import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Política de privacidade</h1>
      <div className="prose prose-sm mt-8 max-w-none space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          O Du Inglês coleta e trata dados pessoais de alunos, responsáveis (quando o
          aluno é menor de idade), professores e visitantes do site em conformidade com a
          Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>
        <h2 className="font-semibold text-foreground">Dados que coletamos</h2>
        <p>
          Nome, e-mail, telefone e, quando aplicável, dados de responsáveis legais de
          alunos menores de idade. Durante o uso da plataforma, também registramos dados
          de frequência, progresso pedagógico e conteúdo das aulas.
        </p>
        <h2 className="font-semibold text-foreground">Base legal e finalidade</h2>
        <p>
          Os dados são tratados para a execução do contrato de prestação de serviços
          educacionais, cumprimento de obrigações legais e, no caso do formulário de
          contato, mediante o seu consentimento para que possamos retornar seu contato.
        </p>
        <h2 className="font-semibold text-foreground">Seus direitos</h2>
        <p>
          Você pode solicitar a qualquer momento a exportação ou a exclusão dos seus dados
          pessoais. Se já é aluno, professor ou administrador, use a seção &quot;Meus
          dados&quot; dentro da plataforma; caso contrário, entre em contato pelo e-mail
          contato@duingles.com.br.
        </p>
        <h2 className="font-semibold text-foreground">Retenção</h2>
        <p>
          Registros de auditoria são mantidos por até 24 meses. Dados pedagógicos são
          mantidos pelo período necessário à prestação do serviço, podendo ser
          anonimizados a pedido do titular.
        </p>
      </div>
    </div>
  );
}
