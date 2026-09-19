# Planejamento — Integração automática com Google Meet

> Objetivo: quando uma aula é agendada (`class_sessions`), o sistema cria automaticamente um link do Google Meet, envia por e-mail para os alunos matriculados na turma, e exibe um botão "Entrar na aula" dentro do sistema que abre o Meet em outra aba.

Este documento é só planejamento — nenhum código foi alterado ainda.

---

## 1. Como o Meet vai ser gerado (decisão técnica)

Não existe uma "API do Google Meet" isolada e simples de sala pré-criada — o link é gerado através de uma API do Google que cria um "recurso" com dados de conferência anexados. Duas rotas possíveis:

### Opção A — Google Calendar API (`events.insert` + `conferenceData`)
Cria um evento na agenda Google de uma conta, pedindo `conferenceDataVersion=1` com `createRequest`. O Google gera o link do Meet e devolve no evento. É o caminho mais documentado e usado.

- ✅ Simples, muito exemplo/tutorial disponível.
- ✅ Pode convidar os alunos como "guests" do evento — o Google manda um convite de calendário automático (complementar ao seu e-mail).
- ⚠️ Controle de acesso à sala (sala de espera / "pedir para entrar") depende das configurações padrão da conta organizadora, não é 100% configurável via essa API.

### Opção B — Google Meet API (`meet.googleapis.com`, "Spaces")
API mais nova, focada só em espaços de reunião. Permite definir `accessType` (`OPEN`, `TRUSTED`, `RESTRICTED`) explicitamente, ou seja, dá mais controle sobre se o aluno entra direto ou fica esperando aprovação.

- ✅ Controle explícito de acesso — relevante para o requisito "link em standby, aluno entra quando quiser".
- ⚠️ Mais nova, menos exemplos prontos, precisa validar comportamento na prática.

**Recomendação:** testar as duas em uma **spike técnica (Fase 0)** antes de comprometer a arquitetura — o ponto crítico é confirmar que o aluno consegue entrar na sala **sem travar em sala de espera** quando o professor ainda não entrou. Esse comportamento muda dependendo de a conta organizadora ser Gmail pessoal ou Google Workspace, e é o maior risco do projeto.

---

## 2. Quem é o "dono" da conta Google que cria as salas

O schema já é **multi-tenant** (`organization_id` em `groups`, `class_sessions`, `profiles`) — ou seja, isso não é uma escola só, são várias organizações usando o sistema. Isso muda o planejamento:

- Cada organização (escola) precisa **conectar sua própria conta Google** uma vez (fluxo OAuth), não dá pra usar uma conta Google única do sistema pra todo mundo.
- Guardar o `refresh_token` da organização de forma **criptografada** em uma tabela nova, ex. `google_integrations` (`organization_id`, `access_token`, `refresh_token`, `expires_at`, `connected_by`, `connected_at`, `scope`).
- Na prática: um admin da organização clica em "Conectar Google Meet" nas configurações, autoriza, e a partir daí todas as aulas daquela organização usam essa conta como organizadora.
- Se o token expira/é revogado, o sistema precisa detectar isso e avisar o admin pra reconectar (aulas continuam sendo agendadas normalmente, só sem link até reconectar — degradação graciosa, no mesmo espírito do `.env.example` atual com Stripe opcional).

---

## 3. Mudanças de schema necessárias

- `class_sessions`: adicionar `meet_link` (text), `meet_event_id` (text — necessário pra depois atualizar/cancelar o evento no Google), `meet_created_at` (timestamptz), `meet_sync_status` (enum: `pending | created | failed | cancelled`).
- Nova tabela `google_integrations` (por `organization_id`) conforme item 2.
- Índice/consulta auxiliar: sessões com `status = 'scheduled'`, `meet_link IS NULL`, `scheduled_at` dentro da janela de antecedência configurada.

---

## 4. Disparo automático — o gap de infraestrutura que precisa ser resolvido

O projeto hoje **não tem** nenhum mecanismo de cron rastreado no repositório: não há `vercel.json`, não há Supabase Edge Functions, não há `node-cron`. A geração recorrente de `class_sessions` (`generate_recurring_sessions()`) já depende de um pg_cron às 3h que **existe só no dashboard do Supabase**, fora do controle de versão — vale registrar isso como débito técnico à parte.

Para criar o link do Meet automaticamente é preciso chamar uma API HTTPS externa (Google) com OAuth — isso o Postgres puro não faz sozinho (exigiria `pg_net` + lógica extra dentro do banco, o que é mais frágil). Caminho recomendado:

- Criar uma rota `src/app/api/cron/create-meet-links/route.ts`.
- Configurar **Vercel Cron** (`vercel.json`, ex. a cada 15–30 min) chamando essa rota.
- A rota busca sessões elegíveis (dentro da janela de antecedência, ex. 24–48h antes, sem link ainda), cria o evento/space no Google usando o token da organização, salva `meet_link` + `meet_event_id`, e dispara o e-mail (Fase 5).
- Tratar erros por sessão individualmente (uma falha não trava o lote), com log/retry na próxima execução.

---

## 5. Envio de e-mail — também não existe hoje

Busquei no repositório: não há Resend, SendGrid, Nodemailer nem nenhuma rota de e-mail. A única coisa parecida é o e-mail transacional nativo do Supabase Auth (convite, reset de senha). Ou seja, **enviar e-mail de aula é uma peça nova, não uma extensão de algo existente**.

- Adicionar um provedor (recomendo **Resend** — integra fácil com Next.js/Vercel, free tier ~3.000 e-mails/mês, depois paga por volume).
- Criar template de e-mail (ex. com `react-email`, que combina bem com Resend) com: nome do aluno, turma, data/hora da aula, botão/link do Meet.
- Disparar para todos os `enrollments` com `status = 'active'` daquele `group_id`, no momento em que o `meet_link` é criado.
- Reenvio: se a aula for remarcada, reenviar e-mail com o novo horário (ou marcar que já foi enviado e só reenviar se o horário mudar).

---

## 6. Botão "Entrar na aula" no sistema

- Local natural: `src/components/features/agenda/agenda-view.tsx` (usado tanto na agenda do aluno `(app)/agenda` quanto do professor `(teacher)/professor/agenda`), e possivelmente também no `planejador/aula/[id]/page.tsx`.
- Regra de exibição: mostrar o botão só quando `meet_link` existir (ou seja, dentro da janela em que já foi gerado) — e opcionalmente só habilitado a partir de X minutos antes do horário agendado, para não confundir o aluno com um link "morto" com muita antecedência.
- Comportamento: `<a href={meet_link} target="_blank" rel="noopener noreferrer">Entrar na aula</a>` — abre em nova aba, como pedido.
- Acesso já é controlado pelo próprio sistema (o botão só aparece pra quem está matriculado ativo na turma) — não é necessário sincronizar a lista de "guests" do Google para controle de acesso, isso é só um bônus (convite automático por e-mail do Google, se optar pela Opção A da seção 1).

---

## 7. Ciclo de vida (casos que não podem ficar de fora)

- **Cancelamento de aula** (`status = 'cancelled'`): cancelar/excluir o evento no Google também, senão o link continua "vivo" e alunos podem entrar numa aula que não vai acontecer.
- **Remarcação de horário**: atualizar o evento existente no Google (não recriar), e reenviar e-mail avisando da mudança.
- **Token revogado/expirado**: cron detecta erro de auth, marca `meet_sync_status = 'failed'`, avisa admin da organização pra reconectar. Aulas continuam existindo no sistema, só sem link até resolver.
- **Aluno matriculado depois do link já criado**: like já dito, acesso é controlado pelo sistema, então o aluno novo já vê o botão normalmente assim que é matriculado — não depende de estar na lista de convidados do Google.

---

## 8. Custos — panorama realista

Comparado com a ideia original de vídeo embutido (Daily/LiveKit/Agora, cobrado por minuto-participante), essa abordagem é **muito mais barata**:

- **Google Calendar API / Google Meet API**: gratuita para este volume de uso — cota padrão generosa, sem cobrança por criação de evento/space.
- **Risco de custo oculto**: se na Fase 0 (spike) a conta Gmail pessoal se mostrar limitada demais no controle de sala de espera, a alternativa é usar uma conta **Google Workspace** paga (a partir de ~US$ 6–12/usuário/mês) por organização, que dá mais controle sobre configurações de reunião. Isso só vira custo real se a Opção A/B com conta pessoal não for suficiente — por isso a spike vem antes de qualquer decisão de arquitetura.
- **Provedor de e-mail (Resend ou similar)**: gratuito até um certo volume, depois cobra por volume de envio — baixo custo esperado pro tamanho do produto hoje.
- **Custo de verificação do app OAuth**: se o número de organizações conectando contas Google crescer além do teste (~100 usuários), o Google exige passar pela tela de consentimento OAuth "verificada" (não é o "security assessment" pesado, que só se aplica a escopos restritos — `calendar.events` é escopo sensível, não restrito) — isso é grátis, mas leva alguns dias/semanas de análise do Google, então deve entrar no cronograma, não no orçamento.

**Custo dominante aqui não é de API — é de desenvolvimento** (fluxo OAuth por organização, cron, template de e-mail, tratamento de erros/reconexão).

---

## 9. Fases propostas

| Fase | Entregável | Observação |
|---|---|---|
| **0. Spike técnica** | Validar na prática Opção A vs B, comportamento de sala de espera com conta pessoal vs Workspace | Bloqueia a decisão de arquitetura das fases seguintes |
| **1. Credenciais Google** | Projeto no Google Cloud, tela de consentimento OAuth, API habilitada, fluxo "Conectar Google" no admin | Por organização |
| **2. Schema** | Colunas em `class_sessions`, tabela `google_integrations` | |
| **3. Geração automática** | Rota de cron + `vercel.json`, criação do evento/space, gravação do link | Depende da Fase 0 e 1 |
| **4. E-mail** | Integração Resend/react-email, template, disparo ao gerar o link, reenvio em remarcação | Peça nova, independente do Google |
| **5. Botão "Entrar na aula"** | UI na agenda (aluno/professor) e no planejador | |
| **6. Ciclo de vida** | Cancelamento, remarcação, reconexão de token, logs/erros | |
| **7. Piloto e rollout** | Testar com 1 turma real, validar sala de espera na prática, depois liberar por organização | |

---

## 10. Perguntas em aberto pra decidir antes de começar

1. Quem inicia a conexão da conta Google — sempre um admin da organização, ou também o professor individualmente (se organizações menores forem 1 professor só)?
2. Antecedência de geração do link: quanto tempo antes da aula o link deve existir e ser enviado por e-mail (ex. 24h, 48h)?
3. O e-mail deve ser reenviado a cada aula da recorrência (semanal, por exemplo), ou só na primeira vez da turma?
4. Se a spike mostrar que conta Gmail pessoal trava em sala de espera, a organização aceita exigir Google Workspace pago, ou isso inviabiliza o plano para parte da base de usuários?
