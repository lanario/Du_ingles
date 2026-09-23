# Auditoria de latência — 23/09/2026

## Escopo e conclusão

Análise do código de navegação, fichas, consultas, ações e atualização em tempo real, com foco no painel administrativo mostrado na captura. Foram inspecionados também caminhos compartilhados com professor/aluno e realizadas requisições públicas ao site publicado.

Há causas concretas de espera no código: temporizadores obrigatórios, dados descartados ao reabrir fichas, consultas encadeadas e carregamento de dados de abas ainda fechadas. Há também mecanismos que podem repetir a atualização da mesma tela. A contribuição de cada um para a latência real exige medição autenticada.

As otimizações de interface e carregamento abaixo foram implementadas depois da auditoria. As medições de produção e o alinhamento de regiões continuam pendentes; este trabalho não altera a hospedagem nem o banco.

## Prioridades

| Ordem | Alteração proposta                                                                          | Benefício esperado                                         | Esforço relativo              |
| ----- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------- |
| 1     | Remover espera mínima das fichas e exibir imediatamente a estrutura útil                    | Elimina o piso artificial de 650/700 ms                    | Pequeno                       |
| 2     | Reaproveitar dados de fichas, antecipar leitura por intenção e reduzir consultas encadeadas | Reabertura rápida e menos viagens ao servidor              | Médio                         |
| 3     | Unificar atualização após ações e evitar recargas repetidas                                 | Menos processamento e menos interrupções após salvar/mover | Médio                         |
| 4     | Carregar a aba inicial primeiro; usar consultas de resumo e paginação                       | Menor espera para entrar em Alunos, Planejador e Painel    | Médio                         |
| 5     | Conferir proximidade entre funções Vercel e banco Supabase                                  | Pode reduzir latência de rede entre serviços               | Depende da configuração atual |
| 6     | Usar visual leve nas áreas operacionais e carregar editores sob demanda                     | Melhor resposta em aparelhos com CPU/GPU limitada          | Pequeno a médio               |

As prioridades 1, 2 (ficha de aluno), 3 (recargas explícitas de Alunos), 4 (Alunos e Planejador administrativo) e 6 foram aplicadas nesta revisão. A consulta de região e as otimizações SQL orientadas por métricas continuam pendentes.

## 1. A abertura da ficha tem uma espera obrigatória

Em [student-ficha-modal.tsx](../src/components/features/admin/students/student-ficha-modal.tsx), `DURACAO_ABERTURA = 650`. A fase aberta exige simultaneamente `tempoMinimoOk` e o término da busca. Em [group-ficha-modal.tsx](../src/components/features/admin/groups/group-ficha-modal.tsx), o mesmo piso é de 700 ms. Com movimento reduzido, o piso passa a 80 ms.

Antes das animações seguintes, a regra é aproximadamente:

```text
Aluno: tempo até liberar a ficha = máximo(tempo da busca, 650 ms)
Turma: tempo até liberar a ficha = máximo(tempo da busca, 700 ms)
```

Os tempos não são somados à busca. Se a rede já demora mais que o piso, remover o temporizador sozinho não elimina essa demora. Em respostas rápidas, ele impõe uma espera evitável, compatível com o cartão “Abrindo aluno” da captura.

**Implementado:** as fichas agora entram diretamente no painel ampliado e mostram o indicador de carregamento dentro dele. Removi o temporizador mínimo e o clique fora fecha o painel mesmo enquanto a leitura ocorre.

## 2. Fichas repetem buscas e carregam dados em etapas

A ficha do aluno apaga `ficha` a cada abertura e chama novamente `getUserByIdAction`. Após abrir, [StudentObjectives](../src/components/features/admin/students/student-objectives.tsx) dispara outra Server Action para os objetivos.

O caminho administrativo contém:

```text
Clique
  → validação da sessão + leitura do perfil de acesso
  → perfil do aluno
  → student_profiles
  → liberação da ficha, respeitando o temporizador
  → nova chamada para objetivos
  → validação da sessão + leitura do perfil de acesso
  → matrícula ativa
  → objetivos individuais/da turma
```

Isso representa duas chamadas do navegador em sequência e seis leituras de banco nesse caminho de sucesso, sem contar eventuais requisições internas de autenticação. Professores podem precisar de consultas adicionais de autorização. Evidências: [users-detail.ts](../src/actions/admin/users-detail.ts), [users.ts](../src/repositories/users.ts), [session.ts](../src/lib/auth/session.ts), [objectives.ts](../src/actions/admin/objectives.ts) e [repositório de objetivos](../src/repositories/objectives.ts).

**Implementado para fichas de aluno:**

- A lista mantém perfil e objetivos em memória por até 45 segundos, escopados ao ciclo de vida do componente autenticado; dados da lista são invalidados quando ela recebe um novo snapshot.
- Cartões antecipam a leitura por foco ou após 120 ms de permanência do ponteiro. Requisições concorrentes do mesmo aluno são unificadas.
- Uma Server Action verifica o acesso uma vez e carrega perfil e objetivos em paralelo. A leitura da matrícula e dos objetivos continua separada internamente no repositório.
- Na ficha avulsa de usuários e na rota específica de turmas, outros caminhos continuam sob demanda.
- Impedir que uma resposta antiga sobrescreva a ficha de outro aluno após uma troca rápida.

O prefetch existente em [link-prefetcher.tsx](../src/components/features/link-prefetcher.tsx) trata links `<a>`; ele não antecipa automaticamente a Server Action acionada pelo botão do cartão.

Em [group-detail.ts](../src/actions/admin/group-detail.ts), a ficha da turma ainda aguarda também listas de alunos, professores, cursos e matrículas ativas da organização. Buscar catálogos necessários apenas para editar/adicionar aluno quando essa operação for iniciada, com busca paginada para catálogos grandes.

## 3. Uma ação pode causar atualizações redundantes

Há três mecanismos no fluxo de movimentação de aluno:

1. [students.ts](../src/actions/admin/students.ts) chama `revalidatePath`.
2. [students-view.tsx](../src/components/features/admin/students/students-view.tsx) chama `router.refresh()` após a resposta.
3. [LiveRefresh](../src/components/features/live-refresh.tsx) também chama `router.refresh()` quando recebe eventos das tabelas assinadas.

O filtro de escritas próprias em [streams.ts](../src/lib/realtime/streams.ts) cobre alguns tipos de autosave, mas não cobre genericamente alterações de perfis e matrículas. O debounce agrupa eventos próximos, sem assegurar que uma atualização ainda em andamento será reaproveitada.

Eram caminhos redundantes possíveis. **Implementado:** removi as chamadas explícitas de `router.refresh()` das ações de Alunos e passei a revalidar `/admin/alunos` nas ações de desativar e reativar. As ações de matrícula já invalidavam a rota. Atualizações adicionais por evento em tempo real ainda dependem de medição; elas foram preservadas para não ignorar mudanças de outras pessoas.

**Proposta:** definir um único fluxo por operação: a resposta devolve os dados alterados, a interface atualiza o item afetado e o servidor invalida os dados necessários. Coordenar eventos próprios com essa atualização e preservar eventos de outras pessoas. Aplicar atualização otimista somente quando houver reversão clara em caso de falha; pagamentos e outras confirmações definitivas dependem da resposta do servidor.

Na matrícula, a ação consulta a matrícula ativa e `enrollStudent` pode consultar novamente o mesmo dado em [enrollments.ts](../src/repositories/enrollments.ts). Uma operação SQL transacional pode reunir validação, alteração e auditoria com menos viagens ao banco. As notificações já usam `after()` e não são a primeira candidata a mover para segundo plano.

## 4. Reduzir os dados exigidos para mostrar a primeira tela

| Local                                                                       | Evidência atual                                                                                                            | Proposta                                                                                                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [Alunos](<../src/app/(admin)/admin/alunos/page.tsx>)                        | Aguarda alunos, turmas e cadastros mesmo com a aba Cadastros fechada                                                       | **Implementado:** agora busca cadastros apenas quando a aba é aberta                                                      |
| [Cadastros](../src/repositories/student-registrations.ts)                   | Busca respostas de todos os cadastros e histórico de assinaturas; escolhe a última assinatura em JavaScript                | Paginar resumos, buscar respostas ao abrir e selecionar a assinatura mais recente no banco                                |
| [Planejador administrativo](<../src/app/(admin)/admin/planejador/page.tsx>) | Aguarda oito carregadores antes de entregar a página                                                                       | **Implementado:** a entrada busca Ateliê e pastas; Agenda e Tarefas carregam ao abrir e atualizam os dados após gravações |
| [Tarefas/modelos](../src/repositories/assignments.ts)                       | Listagens leem `instructions` completo para calcular prévia e quantidade de questões                                       | Retornar projeções compactas e buscar o conteúdo ao abrir o editor                                                        |
| [Painel](../src/repositories/dashboard.ts)                                  | Dez consultas paralelas buscam registros da organização para agregação em JavaScript, sem janela temporal nessas consultas | Contagens/agregações SQL e consultas de séries temporais com intervalo definido                                           |
| [Financeiro](../src/repositories/finance.ts)                                | Busca histórico de lançamentos para compor a visão geral                                                                   | Resumos SQL por período e detalhe paginado; deixar explícita a atualização dos valores                                    |
| [Agenda](../src/repositories/agenda.ts)                                     | Resolve grupos, depois sessões/eventos, depois links de reunião                                                            | Manter dependências de autorização, paralelizar o que for independente e não bloquear a grade por campos secundários      |

O Planejador do professor apresenta o mesmo padrão de múltiplos carregadores. Layouts de aluno, professor e administrador também consultam dados auxiliares; limites de carregamento por componente podem permitir que o conteúdo útil apareça primeiro. Layouts são reaproveitados na navegação: não se deve assumir que todo esse trabalho ocorre em cada clique.

Já existem índices nas migrations. A proposta é analisar consultas reais com planos de execução e estatísticas antes de acrescentar índices compostos; índices também têm custo de escrita. [Orientação oficial do Supabase](https://supabase.com/docs/guides/database/query-optimization).

## 5. Observações do site publicado

Foram realizadas três requisições HTTP públicas por rota, sem cookies autenticados, descartando o corpo após recebê-lo. Tempos observados nesta conexão:

| Rota        | Primeiro byte: mínimo–máximo | Mediana do primeiro byte | Mediana até receber todo o HTML |
| ----------- | ---------------------------- | ------------------------ | ------------------------------- |
| `/`         | 320–388 ms                   | 336 ms                   | 360 ms                          |
| `/login`    | 226–252 ms                   | 238 ms                   | 348 ms                          |
| `/cadastro` | 214–242 ms                   | 221 ms                   | 1.048 ms                        |

Esses tempos incluem o caminho de rede e não medem JavaScript, pintura, hidratação ou a abertura da ficha administrativa. Três amostras não caracterizam p95, horário de pico ou cold starts. O intervalo maior até concluir o HTML de cadastro justifica uma medição do processamento/streaming dessa rota; não identifica sozinho uma consulta lenta.

O cabeçalho da resposta de `/login` continha `X-Vercel-Id: gru1::iad1::…`. A interpretação é uma passagem por São Paulo (`gru1`) e execução em Washington, D.C., EUA (`iad1`), conforme a [documentação de cabeçalhos](https://vercel.com/docs/headers/request-headers) e a [lista de regiões](https://vercel.com/docs/regions).

**Pendência:** confirmar a região efetiva do Supabase e das funções usadas pelo painel. A Vercel recomenda funções próximas à fonte de dados. Se o banco estiver no Brasil e a função nos EUA, cada consulta sequencial pode sofrer com a distância. Se ambos estiverem nos EUA, mudar apenas a função para o Brasil pode piorar a comunicação com o banco. [Configuração oficial de regiões](https://vercel.com/docs/functions/configuring-functions/region).

## 6. Fluidez visual e JavaScript

[shader-background.tsx](../src/components/ui/shader-background.tsx) monta dois fundos WebGL animados quando o modo leve está desligado. Fichas combinam desfoque, Framer Motion e GSAP/ScrollTrigger. Esse trabalho pode disputar CPU/GPU com a interação, especialmente em máquinas menos potentes; não foi realizado perfil de frames para quantificar o efeito.

**Implementado:** o painel administrativo usa o degradê estático e não monta os dois canvases WebGL. O fundo animado continua na página pública. Animações da ficha e de outras áreas ainda podem ser reduzidas em trabalho futuro.

O modo leve já existe. Também já existem prefetch de navegação, tempos de cache do roteador configurados, otimizações de RLS, cache de URLs de avatar, consultas paralelas e importações dinâmicas em partes do editor. O próximo trabalho deve completar esses mecanismos nos caminhos identificados, sem reconstruí-los.

## Plano de execução e critérios de sucesso

1. **Medir a linha de base autenticada:** abertura/reabertura de aluno e turma, troca entre Alunos/Turmas/Agenda/Planejador, movimentação de aluno e salvamento. Registrar pelo menos 30 amostras por cenário, distinguindo primeira visita e retorno com cache.
2. **Primeiro pacote:** remover temporizadores, conteúdo imediato da ficha, cache por sessão e antecipação por intenção.
3. **Segundo pacote:** coordenar mutations/realtime, reduzir consultas encadeadas e separar dados por aba.
4. **Terceiro pacote:** agregações SQL, paginação, índices orientados pelas medições e eventual ajuste de região.
5. **Comparar:** tempo entre clique e primeiro conteúdo útil, tempo até dados completos, número de requests por ação, tempo no servidor, bytes transferidos e travamentos da interface. Usar a mesma conta, conjunto de dados, dispositivo e condição de rede.

Metas iniciais de produto, ainda não resultados: feedback visual em até 100 ms; ficha já em cache útil em até 200 ms; buscar p95 abaixo de 800 ms para leituras principais sem cache, ajustando após a linha de base. Uma gravação remota ainda precisa confirmar o resultado; a interface pode responder imediatamente sem afirmar que uma operação pendente já terminou.

Toda otimização deve manter as verificações de acesso e a separação de dados por usuário/organização. Não é necessário afrouxar autenticação, RLS ou CSP para aplicar as melhorias propostas.
