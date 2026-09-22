import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_POLICY_VERSION } from "@/lib/consent/record";
import { LegalIdentity } from "@/components/features/marketing/legal-identity";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/school-contact";

export const metadata: Metadata = { title: "Política de privacidade" };

const H2 = "pt-2 font-semibold text-foreground";

/**
 * Texto versionado: `PRIVACY_POLICY_VERSION` é o que fica gravado em
 * `consent_records` quando alguém aceita. Mudou algo relevante aqui? Suba a
 * versão lá, senão os aceites novos apontam para um texto que já não existe.
 */
export default function PrivacidadePage() {
  const [year, month, day] = PRIVACY_POLICY_VERSION.split("-");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Política de privacidade</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Versão de {day}/{month}/{year}
      </p>
      <div className="prose prose-sm mt-8 max-w-none space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          O Du Inglês é o controlador dos dados pessoais de alunos, responsáveis (quando o
          aluno é menor de idade), professores, equipe e visitantes do site, e os trata de
          acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>
        <LegalIdentity />

        <h2 className={H2}>Dados que coletamos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Cadastro:</strong> nome, e-mail, telefone, data de nascimento, CPF e,
            se você quiser, foto de perfil.
          </li>
          <li>
            <strong>Responsáveis:</strong> nome, e-mail e telefone do responsável por
            aluno menor de idade.
          </li>
          <li>
            <strong>Preferências de aprendizagem:</strong> objetivos para estudar inglês,
            tópicos de interesse, estilo de ensino preferido e, quando informado, área de
            trabalho e profissão.
          </li>
          <li>
            <strong>Cadastro e plano:</strong> plano selecionado e situação da assinatura.
            Os dados do cartão são informados diretamente ao Stripe.
          </li>
          <li>
            <strong>Vida escolar:</strong> turmas, frequência, tarefas, respostas, notas,
            observações pedagógicas, conteúdo das aulas e mensagens trocadas na
            plataforma.
          </li>
          <li>
            <strong>Gravações de aula:</strong> imagem e voz de quem participa da aula com
            câmera e microfone ligados.
          </li>
          <li>
            <strong>Financeiro:</strong> plano contratado, valores e situação dos
            pagamentos. Dados de cartão são digitados direto no Stripe e nunca passam
            pelos nossos servidores.
          </li>
          <li>
            <strong>Visitantes:</strong> nome, e-mail, telefone e mensagem enviados nos
            formulários de contato e de aula experimental.
          </li>
          <li>
            <strong>Registros de acesso e segurança:</strong> ações feitas na conta, data
            e hora, endereço IP e navegador.
          </li>
        </ul>

        <h2 className={H2}>Para que usamos e com qual base legal</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Prestar o serviço educacional: turmas, aulas, tarefas, progresso e comunicação
            (execução de contrato, art. 7º, V).
          </li>
          <li>
            Cobrança e obrigações fiscais (execução de contrato e cumprimento de obrigação
            legal, art. 7º, II e V).
          </li>
          <li>
            Registros de acesso, pelo prazo exigido pelo Marco Civil da Internet
            (obrigação legal, art. 7º, II), e segurança da conta e prevenção a fraude
            (legítimo interesse, art. 7º, IX).
          </li>
          <li>
            Responder a contatos e pedidos de aula experimental (a seu pedido e com a sua
            autorização, art. 7º, I e V).
          </li>
          <li>
            Cookies de preferência e a integração opcional com o Google Agenda (seu
            consentimento, art. 7º, I, que pode ser retirado a qualquer momento).
          </li>
        </ul>
        <p>
          Não vendemos dados, não usamos para publicidade e não tomamos decisões sobre
          você baseadas só em tratamento automatizado. A correção automática de exercícios
          de múltipla escolha é revisável pelo professor; se discordar de uma nota, fale
          com ele ou com a coordenação.
        </p>

        <h2 className={H2}>Crianças e adolescentes</h2>
        <p>
          Atendemos alunos menores de idade. Os dados deles são tratados no seu melhor
          interesse (art. 14), limitados ao necessário para as aulas. A matrícula de aluno
          menor é combinada com o responsável, cujos dados de contato ficam registrados na
          ficha do aluno. O responsável pode exercer todos os direitos descritos abaixo em
          nome dele. A foto de perfil é opcional e, nas aulas, o aluno pode manter a
          câmera desligada.
        </p>

        <h2 className={H2}>Com quem compartilhamos</h2>
        <p>
          Só com fornecedores que operam a plataforma em nosso nome, sob contrato e para
          as finalidades acima:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Supabase</strong> — banco de dados, arquivos e login. Dados
            armazenados em São Paulo (Brasil).
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem do site e da plataforma.
          </li>
          <li>
            <strong>Stripe</strong> — processamento de pagamentos.
          </li>
          <li>
            <strong>Google</strong> — as aulas acontecem no Google Meet e as gravações
            ficam no Google Drive da escola; o Google Agenda só entra se você conectar
            (veja abaixo).
          </li>
          <li>
            <strong>WhatsApp</strong> — envio do convite de acesso e contato com a
            coordenação, quando você usa esse canal.
          </li>
        </ul>
        <p>
          Alguns desses fornecedores processam dados fora do Brasil, principalmente nos
          Estados Unidos. Essa transferência internacional (art. 33) acontece com
          fornecedores que adotam cláusulas contratuais de proteção de dados e padrões de
          segurança reconhecidos. Também podemos compartilhar dados quando uma lei ou
          autoridade exigir.
        </p>

        <h2 className={H2}>Integração com o Google Agenda</h2>
        <p>
          Se você optar por conectar sua conta Google, o Du Inglês solicita acesso ao
          Google Agenda apenas para criar, atualizar e cancelar eventos das suas aulas,
          incluindo o link do Google Meet, com o lembrete da sua própria agenda. Não
          lemos, não armazenamos nem usamos o restante da sua agenda ou de outros serviços
          Google.
        </p>
        <p>
          Guardamos somente o token de autorização necessário para manter a integração,
          criptografado, e os identificadores dos eventos criados pela plataforma. Esses
          dados não são vendidos, compartilhados com terceiros nem usados para
          publicidade. O uso e a transferência das informações recebidas das APIs do
          Google seguem a{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado. Você pode desconectar a integração a
          qualquer momento na plataforma ou em{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>

        <h2 className={H2}>Gravações das aulas</h2>
        <p>
          As aulas ao vivo são gravadas pelo Google Meet para que alunos que faltaram
          possam assistir depois (execução do contrato, art. 7º, V). A gravação fica no
          Google Drive da escola, e o link é mostrado apenas para os alunos da turma, na
          biblioteca. Quem não quiser aparecer pode participar com a câmera desligada.
          Você pode pedir a remoção de um trecho em que aparece pelo canal indicado
          abaixo.
        </p>

        <h2 className={H2}>Cookies</h2>
        <p>
          Usamos apenas cookies necessários para o login e, se você permitir, o
          armazenamento de preferências de tela no seu navegador. Não há cookies de
          publicidade nem de rastreamento de terceiros. A lista completa e a forma de
          mudar sua escolha estão na{" "}
          <Link href="/cookies" className="underline">
            política de cookies
          </Link>
          .
        </p>

        <h2 className={H2}>Por quanto tempo guardamos</h2>
        <p>
          Enquanto durar a sua relação com a escola e, depois dela, apenas pelo tempo
          necessário para cumprir obrigações legais (fiscais e de registro de acesso),
          exercer direitos em eventual processo ou atender a um pedido seu. Terminado esse
          prazo, os dados são eliminados ou anonimizados.
        </p>

        <h2 className={H2}>Segurança</h2>
        <p>
          Aplicamos controle de acesso por perfil em todas as tabelas, conexões
          criptografadas, arquivos privados com links temporários e registro das ações
          sensíveis. Se ocorrer um incidente que possa causar risco ou dano relevante,
          avisaremos você e a Autoridade Nacional de Proteção de Dados (art. 48).
        </p>

        <h2 className={H2}>Seus direitos</h2>
        <p>Pelo art. 18 da LGPD, você pode pedir, a qualquer momento:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>
            anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em
            desconformidade;
          </li>
          <li>portabilidade dos dados;</li>
          <li>eliminação dos dados tratados com base no seu consentimento;</li>
          <li>informação sobre com quem compartilhamos seus dados;</li>
          <li>informação sobre a possibilidade de não consentir e suas consequências;</li>
          <li>revogação do consentimento;</li>
          <li>revisão de decisões tomadas só com base em tratamento automatizado.</li>
        </ul>
        <p>
          Se você tem conta, use &quot;Meus dados&quot; dentro da plataforma: lá você
          baixa uma cópia dos seus dados, gerencia cookies e faz qualquer um dos pedidos
          acima, inclusive a exclusão da conta. Cada pedido recebe um número de protocolo
          e você acompanha a resposta por ali. O pedido de exclusão pode ser cancelado nos
          primeiros 7 dias. Se você não tem conta, escreva para{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="underline">
            {PRIVACY_CONTACT_EMAIL}
          </a>
          . Respondemos em até 15 dias. Alguns dados podem precisar ser mantidos mesmo
          após um pedido de exclusão, quando a lei exigir; nesse caso explicamos quais e
          por quê.
        </p>
        <p>
          Se não ficar satisfeito com a resposta, você pode reclamar à Autoridade Nacional
          de Proteção de Dados (ANPD), em{" "}
          <a
            href="https://www.gov.br/anpd"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            gov.br/anpd
          </a>
          .
        </p>

        <h2 className={H2}>Encarregado pelo tratamento de dados</h2>
        <p>
          Dúvidas sobre esta política e pedidos de titulares são atendidos pelo canal{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="underline">
            {PRIVACY_CONTACT_EMAIL}
          </a>
          .
        </p>

        <h2 className={H2}>Mudanças nesta política</h2>
        <p>
          Quando esta política mudar de forma relevante, a data de versão no topo muda e,
          se a mudança depender do seu consentimento, pediremos de novo.
        </p>
      </div>
    </div>
  );
}
