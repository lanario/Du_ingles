import type { Metadata } from "next";
import Link from "next/link";
import { LegalIdentity } from "@/components/features/marketing/legal-identity";
import { TERMS_VERSION } from "@/lib/consent/record";
import { SCHOOL_EMAIL } from "@/lib/school-contact";

export const metadata: Metadata = { title: "Termos de uso" };

const H2 = "pt-2 font-semibold text-foreground";

/**
 * Texto versionado: `TERMS_VERSION` é o que fica gravado em `consent_records`
 * quando alguém aceita no cadastro. Mudou algo relevante aqui? Suba a versão.
 *
 * Tudo o que está escrito precisa ser verdade na plataforma — se uma regra
 * mudar no código (cancelamento, gravação, acesso), este texto muda junto.
 */
export default function TermosPage() {
  const [year, month, day] = TERMS_VERSION.split("-");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Termos de uso</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Versão de {day}/{month}/{year}
      </p>
      <div className="prose prose-sm mt-8 max-w-none space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Estes termos regem o uso do site e da plataforma do Du Inglês por alunos,
          responsáveis, professores e equipe. Ao criar seu acesso você declara que leu e
          aceita estes termos e a{" "}
          <Link href="/privacidade" className="underline">
            política de privacidade
          </Link>
          . Se o aluno for menor de idade, quem aceita e responde pelo contrato é o
          responsável legal.
        </p>

        <h2 className={H2}>Quem presta o serviço</h2>
        <LegalIdentity />

        <h2 className={H2}>O serviço</h2>
        <p>
          O Du Inglês oferece aulas de inglês ao vivo e online, em turmas organizadas por
          nível (padrão CEFR, do A1 ao C2). A plataforma reúne a agenda das aulas, o link
          da sala virtual, tarefas e correções, o material de cada aula em PDF, as
          gravações, o acompanhamento do seu progresso e as mensagens com a turma e a
          coordenação.
        </p>

        <h2 className={H2}>Acesso à plataforma</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Você pode criar sua conta pelo formulário de cadastro, informar suas
            preferências de aprendizagem, escolher um plano e definir sua senha. A
            coordenação recebe as respostas e organiza sua turma e seu professor.
          </li>
          <li>
            Mantenha sua senha em sigilo e não compartilhe a conta. Avise a coordenação se
            suspeitar de uso indevido.
          </li>
          <li>Os dados informados no cadastro precisam ser verdadeiros e atualizados.</li>
          <li>
            O acesso pode ser desativado ao fim do contrato ou em caso de violação destes
            termos. Seus dados continuam disponíveis para pedidos previstos na LGPD.
          </li>
        </ul>

        <h2 className={H2}>Aulas ao vivo e gravações</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            As aulas acontecem pelo Google Meet, no dia e horário da sua turma. O link
            aparece na plataforma pouco antes do início.
          </li>
          <li>
            As aulas são gravadas para quem faltou ou quer rever. A gravação mostra imagem
            e voz de quem participa com câmera e microfone ligados, e fica disponível só
            para a turma, pela biblioteca. Se preferir não aparecer, participe com a
            câmera desligada.
          </li>
          <li>
            É proibido gravar, baixar, fotografar ou divulgar aulas, gravações e colegas
            por conta própria.
          </li>
          <li>Mudanças de turma ou horário são combinadas com a coordenação.</li>
        </ul>

        <h2 className={H2}>Aula experimental</h2>
        <p>
          A experiência inicial de 7 dias é gratuita. Para escolher um plano, você informa
          um meio de pagamento no ambiente seguro do Stripe; nenhuma cobrança é feita
          durante esse período. A aula experimental com professor é combinada com a
          coordenação.
        </p>

        <h2 className={H2}>Planos e pagamento</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Os planos, com preço, frequência e período de cobrança, estão na página de
            planos da plataforma. Após os 7 dias de experiência, o plano escolhido é
            cobrado automaticamente conforme sua periodicidade, até o cancelamento.
          </li>
          <li>
            O pagamento é processado pelo Stripe. Os dados do cartão são digitados direto
            no ambiente do Stripe e não passam pelos servidores do Du Inglês.
          </li>
          <li>
            Faturas, recibos e a forma de pagamento ficam no portal de faturas, acessível
            pela plataforma.
          </li>
        </ul>

        <h2 className={H2}>Cancelamento e arrependimento</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Você pode desistir da contratação em até 7 dias após a assinatura, com
            devolução integral do valor pago (Código de Defesa do Consumidor, art. 49).
          </li>
          <li>
            Durante os 7 dias de experiência, você pode cancelar pela aba Planos. O
            cancelamento agendado mantém o acesso até o fim da experiência e impede a
            primeira cobrança. Depois desse período, o plano pode ser cancelado a qualquer
            momento pelo portal de faturas ou falando com a coordenação, sem multa por
            fidelidade. O cancelamento interrompe as próximas cobranças.
          </li>
        </ul>

        <h2 className={H2}>Conduta</h2>
        <p>
          Nas aulas, nas mensagens e nas tarefas, trate colegas, professores e equipe com
          respeito. Não são permitidos assédio, discriminação, conteúdo ilegal ou
          ofensivo, spam, nem a tentativa de acessar dados ou áreas de outras pessoas.
          Mensagens na conversa da turma são vistas por todos os participantes dela. A
          coordenação pode remover conteúdo, silenciar conversas e, em casos graves,
          desativar o acesso.
        </p>

        <h2 className={H2}>Conteúdo e propriedade intelectual</h2>
        <p>
          O material das aulas, os exercícios, as gravações, a marca e a plataforma
          pertencem ao Du Inglês ou são usados com autorização. Eles podem ser usados pelo
          aluno matriculado, para o próprio estudo, sem redistribuição. O que você escreve
          nas tarefas continua sendo seu; você autoriza o uso desse conteúdo para correção
          e acompanhamento pedagógico.
        </p>

        <h2 className={H2}>Integração com o Google Agenda</h2>
        <p>
          Conectar sua conta Google é opcional. Serve para colocar as aulas na sua agenda,
          com o link do Meet, e pode ser desfeito a qualquer momento. Os detalhes estão na
          política de privacidade.
        </p>

        <h2 className={H2}>Disponibilidade e responsabilidade</h2>
        <p>
          Trabalhamos para manter a plataforma disponível e segura, mas podem ocorrer
          interrupções para manutenção ou por falhas de serviços de terceiros. Não
          respondemos por problemas na sua conexão de internet ou no seu equipamento. Nada
          nestes termos limita os direitos garantidos pelo Código de Defesa do Consumidor.
        </p>

        <h2 className={H2}>Mudanças nestes termos</h2>
        <p>
          Quando estes termos mudarem de forma relevante, a data de versão no topo muda e
          avisamos pela plataforma antes de a mudança valer.
        </p>

        <h2 className={H2}>Contato e foro</h2>
        <p>
          Dúvidas, reclamações e pedidos:{" "}
          <a href={`mailto:${SCHOOL_EMAIL}`} className="underline">
            {SCHOOL_EMAIL}
          </a>
          . Estes termos seguem a lei brasileira, e eventuais disputas podem ser levadas
          ao foro do seu domicílio.
        </p>
      </div>
    </div>
  );
}
