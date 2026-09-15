# Plano de adequação à LGPD — Du Inglês

> Lei nº 13.709/2018 (LGPD). Documento técnico de planejamento: inventário do que
> a plataforma trata hoje, lacunas encontradas na varredura do código e o
> roteiro de implementação. Não é parecer jurídico — a redação final de política,
> contratos e o RIPD precisam passar por advogado.

**Data da varredura:** 14/09/2026
**Escopo:** todo `src/`, `supabase/migrations/`, `next.config.ts`, `middleware.ts`.
**Papel da escola:** **controladora**. Supabase, Vercel e Stripe são **operadores**.

---

## 1. Inventário de dados pessoais (o que existe hoje)

### 1.1 Titulares

| Titular | Como entra | Tem conta? | Consegue exercer direitos sozinho? |
|---|---|---|---|
| Aluno (maior) | Convite → `/convite/[token]` | Sim | Parcialmente |
| Aluno (menor) | Convite → `/convite/[token]` | Sim | **Não — sem fluxo de responsável** |
| Responsável legal | Digitado pelo admin em `student_profiles` | **Não** | **Não — nenhum canal** |
| Professor | Convite | Sim | Parcialmente |
| Admin / coordenação | Convite | Sim | Parcialmente |
| Lead / visitante | `createLeadAction`, `createTrialLeadAction` | **Não** | **Não — nenhum canal** |

### 1.2 Dados por tabela

| Tabela | Campos pessoais | Categoria | Base legal provável |
|---|---|---|---|
| `profiles` | `full_name`, `email`, `phone`, `birth_date`, **`cpf`**, `avatar_url`, `last_seen_at` | Identificação | Execução de contrato (art. 7, V) |
| `student_profiles` | `guardian_name`, `guardian_email`, `guardian_phone`, `goals`, **`notes`** | Identificação de terceiro + avaliação | Contrato / legítimo interesse |
| `teacher_profiles` | `bio`, `certifications`, `hourly_rate` | Profissional / financeiro | Contrato |
| `leads` | `name`, `email`, `phone`, `message` (guarda "maior de 18: sim/não") | Identificação | **Consentimento (art. 7, I) — hoje sem prova** |
| `attendance` | `status`, `recorded_at` por aluno | Comportamental | Contrato |
| `assignment_submissions` | `content`, `score`, `feedback` | Avaliação pedagógica | Contrato |
| `class_sessions` | **`teacher_notes`** (observações sobre alunos), `homework`, `content`, `recording_url` | Avaliação / possível opinião sobre menor | Legítimo interesse |
| `messages` / `conversations` | `body`, `sender_id` (soft delete via `deleted_at`) | Comunicação | Contrato |
| `notifications` | `title`, `body` (podem conter nome e contato de lead) | Comunicação | Contrato |
| `audit_logs` | `actor_id`, `action`, `metadata`, **`ip_address`**, **`user_agent`** | Registro de acesso | Obrigação legal (MCI art. 15) |
| `rate_limits` | `identifier` = **endereço IP** | Segurança | Legítimo interesse |
| `student_subscriptions` / `finance_entries` | valores, `stripe_customer_id`, faturas | Financeiro | Contrato / obrigação fiscal |
| `user_invites` | `email`, `full_name`, token | Identificação | Contrato |
| Storage `avatars` | Retrato da pessoa (pode ser menor) | **Imagem** | Consentimento |
| Storage `lesson-assets` | Imagens coladas em aula | Variável | Contrato |

### 1.3 Transferência internacional

Supabase, Vercel e Stripe processam e armazenam fora do Brasil (EUA/UE conforme
região). Isso é **transferência internacional (LGPD art. 33)** e hoje **não está
declarado em lugar nenhum** — nem na política, nem em contrato de operador.

---

## 2. O que já está pronto (não refazer)

A base é melhor que a média. Reconhecendo o que existe para não reimplementar:

- **Segurança técnica (art. 46)** está bem endereçada: RLS no Supabase, CSP com
  nonce por request ([middleware.ts](../src/middleware.ts)), HSTS / X-Frame-Options /
  nosniff ([next.config.ts](../next.config.ts)), buckets privados servidos por
  signed URL curta, `service_role` nunca exposta ao cliente, rate limit por IP,
  revogação de sessões ao desativar usuário.
- **Trilha de auditoria** (`audit_logs`) com 50+ ações mapeadas e escrita
  exclusiva por service-role ([src/lib/audit.ts](../src/lib/audit.ts)) — um cliente
  comprometido não forja nem apaga o próprio rastro.
- **Exportação de dados** já existe: [`/api/lgpd/export`](../src/app/api/lgpd/export/route.ts)
  + [`exportOwnData`](../src/repositories/lgpd.ts) — com o cuidado correto de não
  vazar dados de terceiros.
- **Pedido de exclusão** registrado e notificado ([src/actions/shared/lgpd.ts](../src/actions/shared/lgpd.ts)).
- **Banner de cookies** e páginas de política e termos publicadas.
- **Nenhum rastreador de terceiros** (sem GA, Meta Pixel, Hotjar) — isso
  simplifica enormemente a parte de cookies.
- **Nenhum PII em `console.log`** (verificado nas 20 ocorrências).

---

## 3. Lacunas encontradas

Severidade: 🔴 bloqueia operação regular · 🟠 risco relevante · 🟡 melhoria

### 🔴 L-01 — Não existe registro formal de requisição do titular (art. 18, art. 19)

`requestDataDeletionAction` grava um log de auditoria e dispara uma notificação
no sino. **Não há tabela de requisições.** Consequências:

- Sem status, sem protocolo, sem prazo. A LGPD exige resposta em até **15 dias**
  (art. 19, II) para acesso/portabilidade e imediata para confirmação.
- Nenhuma tela lista pedidos pendentes — se o admin não vir o sino, o pedido
  some.
- O titular não recebe comprovante nem acompanha o andamento.
- Só cobre **exclusão**. Faltam os outros direitos do art. 18: correção (III),
  anonimização/bloqueio (IV), portabilidade (V), eliminação (VI), informação
  sobre compartilhamento (VII), revogação de consentimento (IX).

### 🔴 L-02 — Exclusão não exclui nada (art. 16, art. 18 VI)

[`softDeleteUser`](../src/repositories/users.ts) (linha 187) apenas faz
`is_active = false, deleted_at = now()`. Após "excluir":

- `full_name`, `email`, `cpf`, `phone`, `birth_date` continuam íntegros.
- O usuário em `auth.users` continua existindo com o e-mail.
- O avatar continua no bucket `avatars`.
- Não há rotina de **anonimização** que preserve o histórico pedagógico/fiscal
  (que tem retenção legítima) e apague o identificador.

### 🔴 L-03 — Nenhuma prova de consentimento (art. 8 §1, art. 7 I)

- **Leads**: `createLeadAction` e `createTrialLeadAction` gravam nome, e-mail e
  telefone **sem checkbox de consentimento, sem timestamp de aceite, sem versão
  do texto aceito**. O ônus da prova é do controlador (art. 8 §2).
- **Cadastro**: o [accept-invite-form.tsx](../src/components/features/auth/accept-invite-form.tsx)
  (linha 208) só exibe links passivos para termos/privacidade. Nenhum registro de
  que a pessoa aceitou, nem qual versão.
- **Banner de cookies**: o aceite vive só no `localStorage` do navegador. Não é
  prova, some ao limpar o navegador.

### 🔴 L-04 — Dados de menores sem tratamento específico (art. 14)

`birth_date` é coletado e `student_profiles` tem campos de responsável, mas:

- Nenhuma lógica lê a idade. Não existe `isMinor` em lugar nenhum do código.
- O formulário de aula experimental pergunta "maior de 18?" e joga a resposta
  **dentro de um texto livre em `leads.message`** — não é campo consultável nem
  acionável.
- Art. 14 §1 exige **consentimento específico e em destaque** de pelo menos um
  dos pais para crianças (menores de 12). Não existe.
- Art. 14 §5 exige esforço razoável para **verificar** que o consentimento foi
  dado pelo responsável. Não existe.
- Art. 14 §6 exige informação **pública** sobre os dados de crianças coletados.
  A política atual só cita responsáveis de passagem.

### 🟠 L-05 — Direito de acesso incompleto (art. 18, II)

O export omite dados pessoais que a plataforma tem sobre o titular:

| Não exportado | Onde está |
|---|---|
| `profiles.cpf` | [lgpd.ts](../src/repositories/lgpd.ts) — fora do `select` |
| `student_profiles.notes` | observações da coordenação sobre o aluno |
| `class_sessions.teacher_notes` | observações do professor **sobre o aluno** (só sai no export do professor) |
| `audit_logs` do próprio titular | acessos e alterações na sua conta |
| `notifications` recebidas | — |
| `student_subscriptions` / `finance_entries` | histórico financeiro do aluno |
| `attendance` do professor | — |
| Metadados de `avatars` | — |

Notas sobre o titular são dado pessoal dele. Restringir acesso exige justificar
segredo comercial (art. 19 §1) — decisão a tomar conscientemente, não por
esquecimento.

### 🟠 L-06 — Sem política de retenção executável (art. 15, art. 16)

A política publicada **promete** que "registros de auditoria são mantidos por até
24 meses". Não existe nenhum job que apague nada:

- `audit_logs` cresce para sempre (e carrega IP, que é dado pessoal).
- `leads` cresce para sempre — visitante que pediu aula experimental há 3 anos
  continua no banco.
- `rate_limits` guarda IPs sem expurgo.
- `notifications` sem limpeza.
- Nenhum `pg_cron` de retenção nas migrations (verificado em todas).

**Prometer na política e não cumprir é pior que não prometer.**

### 🟠 L-07 — Exportação sem rastro nem limite

[`/api/lgpd/export`](../src/app/api/lgpd/export/route.ts) despeja o dossiê completo
do titular em JSON e **não chama `auditLog`** e **não tem rate limit**. Se uma
sessão for sequestrada, o vazamento não deixa rastro.

### 🟠 L-08 — `audit_logs.ip_address` e `user_agent` nunca são preenchidos

As colunas existem no schema mas [`auditLog()`](../src/lib/audit.ts) não as
popula. Sem IP e user-agent, a trilha não serve para investigar incidente
(art. 48) nem para demonstrar diligência.

### 🟠 L-09 — Sem encarregado (DPO) designado e publicado (art. 41)

Nenhuma menção a encarregado no código nem na política. Art. 41 §1 exige que a
identidade e o contato do encarregado sejam **divulgados publicamente**.
A política manda para `contato@duingles.com.br`, que é o e-mail geral.

### 🟠 L-10 — Transferência internacional não declarada (art. 33)

Ver §1.3. A política não menciona que os dados saem do Brasil, nem sob qual
salvaguarda (cláusulas-padrão / adequação).

### 🟠 L-11 — Sem plano de resposta a incidente (art. 48)

Não há tabela de incidentes, runbook, nem definição de quem comunica a ANPD e os
titulares em prazo razoável. Nada no repositório.

### 🟡 L-12 — Correção de dados limitada (art. 18, III)

[`profile-form.tsx`](../src/components/features/account/profile-form.tsx) permite
editar apenas `fullName`, `phone`, `birthDate`. **E-mail e CPF não são
editáveis nem solicitáveis** — não há fluxo de pedido de correção.

### 🟡 L-13 — Decisão automatizada sem direito de revisão explícito (art. 20)

[`autoGrade`](../src/lib/assignments/exercises.ts) (linha 211) atribui nota
automaticamente a múltipla escolha, V/F e resposta curta. O professor revisa as
abertas, mas o aluno não tem botão de "solicitar revisão da correção" nem
informação sobre os critérios usados.

### 🟡 L-14 — Política e termos rasos demais

[`privacidade/page.tsx`](../src/app/%28marketing%29/privacidade/page.tsx) tem 43
linhas. Não cita: CPF, avatar/imagem, gravações de aula, dados
financeiros/Stripe, operadores, transferência internacional, encarregado, prazo
de resposta, direito de reclamação à ANPD, versionamento do documento.

### 🟡 L-15 — Responsáveis e leads sem canal de exercício de direitos

Ambos são titulares, nenhum tem conta. A política manda escrever um e-mail — não
existe formulário público nem protocolo.

### 🟡 L-16 — Sem ROPA e sem RIPD (art. 37, art. 38)

Registro das operações de tratamento não existe como artefato. Dado que há
tratamento de dados de **crianças e adolescentes**, a ANPD pode requisitar RIPD.

---

## 4. Plano de implementação

### Fase 1 — Fundação (bloqueantes) · ~2 semanas

#### 1.1 Migration `0041_lgpd_core.sql`

```sql
-- Requisições do titular
create type lgpd_request_kind as enum (
  'access', 'rectification', 'deletion', 'anonymization',
  'portability', 'sharing_info', 'consent_withdrawal'
);
create type lgpd_request_status as enum (
  'open', 'in_progress', 'fulfilled', 'rejected', 'partially_fulfilled'
);

create table lgpd_requests (
  id              uuid primary key default gen_random_uuid(),
  protocol        text not null unique,          -- ex.: LGPD-2026-0001
  organization_id uuid not null references organizations(id),
  requester_id    uuid references profiles(id),  -- null = titular sem conta
  requester_name  text not null,
  requester_email text not null,
  kind            lgpd_request_kind not null,
  status          lgpd_request_status not null default 'open',
  details         text,
  due_at          timestamptz not null default (now() + interval '15 days'),
  handled_by      uuid references profiles(id),
  resolution      text,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index on lgpd_requests (organization_id, status, due_at);

-- Prova de consentimento (art. 8 §1)
create type consent_purpose as enum (
  'terms_of_use', 'privacy_policy', 'marketing_contact',
  'trial_class', 'cookies', 'guardian_minor'
);

create table consent_records (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id),
  subject_id       uuid references profiles(id),
  subject_email    text not null,
  purpose          consent_purpose not null,
  granted          boolean not null,
  document_version text not null,    -- versão do texto aceito
  ip_address       inet,
  user_agent       text,
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz
);
create index on consent_records (subject_email, purpose, created_at desc);

-- Incidentes de segurança (art. 48)
create table security_incidents (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id),
  detected_at          timestamptz not null,
  description          text not null,
  affected_count       integer,
  data_categories      text[],
  severity             text not null,
  anpd_notified_at     timestamptz,
  subjects_notified_at timestamptz,
  mitigation           text,
  created_at           timestamptz not null default now()
);

-- Consentimento de lead + maioridade como coluna, não como texto livre
alter table leads
  add column consent_at      timestamptz,
  add column consent_version text,
  add column is_adult        boolean,
  add column guardian_name   text,
  add column guardian_email  text;

-- Sem policy para authenticated nas três tabelas novas: leitura e escrita só
-- por service-role, mesmo desenho já usado em audit_logs.
alter table lgpd_requests      enable row level security;
alter table consent_records    enable row level security;
alter table security_incidents enable row level security;
```

#### 1.2 Retenção — migration `0042_data_retention.sql`

```sql
create or replace function purge_expired_personal_data()
returns void language plpgsql security definer as $fn$
begin
  -- 24 meses: o que a política já promete
  delete from audit_logs   where created_at < now() - interval '24 months';
  -- leads sem conversão: 12 meses
  delete from leads        where created_at < now() - interval '12 months';
  delete from rate_limits  where created_at < now() - interval '7 days';
  delete from notifications
    where created_at < now() - interval '12 months' and read_at is not null;
end $fn$;

select cron.schedule(
  'purge-personal-data', '0 4 * * *',
  $job$select purge_expired_personal_data()$job$
);
```

> Antes de aplicar: **decidir os prazos com o jurídico** e alinhar o texto da
> política ao que o job realmente faz. Guarda fiscal de `finance_entries` é
> 5 anos e **não** entra no expurgo.

#### 1.3 Anonimização real — `src/services/lgpd-erasure.ts` (novo)

```
anonymizeUser(userId):
  1. profiles → full_name = 'Titular removido',
                email = 'removido+<id>@invalido.local',
                cpf = null, phone = null, birth_date = null, avatar_url = null
  2. deleteAvatar(path) no bucket avatars
  3. student_profiles → guardian_* = null, notes = null, goals = null
  4. messages → body = '[mensagem removida a pedido do titular]'
  5. class_sessions.teacher_notes → remover menções nominais (revisão humana)
  6. auth.admin.deleteUser(userId)   ← remove o e-mail do auth
  7. revokeUserSessions(userId)
  8. auditLog('LGPD_ANONYMIZED')     ← o log fica, sem o nome
```

Preservar: `attendance`, `assignment_submissions` (notas) e `finance_entries` —
com a FK apontando para o perfil anonimizado. Isso atende o art. 16 (guarda para
cumprimento de obrigação legal) sem manter o identificador.

#### 1.4 Ajustes nos arquivos existentes

| Arquivo | Mudança |
|---|---|
| [src/lib/audit.ts](../src/lib/audit.ts) | popular `ip_address` e `user_agent` via `getClientIp()` e `headers()` |
| [src/app/api/lgpd/export/route.ts](../src/app/api/lgpd/export/route.ts) | `auditLog('LGPD_EXPORT')` + `checkRateLimit(userId, 'lgpd_export', 3, 86400)` |
| [src/repositories/lgpd.ts](../src/repositories/lgpd.ts) | incluir `cpf`, `student_profiles.notes`, `audit_logs` próprios, `notifications`, assinaturas e financeiro; `teacher_notes` referentes ao aluno (decisão a tomar) |
| [src/actions/shared/lgpd.ts](../src/actions/shared/lgpd.ts) | gravar em `lgpd_requests` e devolver o protocolo ao titular |
| [src/actions/leads/create-lead.ts](../src/actions/leads/create-lead.ts) | exigir `consent` no schema; gravar `consent_at`, `consent_version` e `consent_records` |
| [src/actions/leads/create-trial-lead.ts](../src/actions/leads/create-trial-lead.ts) | idem + `is_adult` como coluna + campos de responsável quando menor |
| [src/actions/auth/accept-invite.ts](../src/actions/auth/accept-invite.ts) | exigir aceite explícito de termos e política; gravar `consent_records` |
| [src/schemas/leads.ts](../src/schemas/leads.ts) | `consent: z.literal(true)`, `guardianName` / `guardianEmail` condicionais |

---

### Fase 2 — Direitos do titular ponta a ponta · ~2 semanas

#### 2.1 Painel do titular — estender [lgpd-panel.tsx](../src/components/features/lgpd/lgpd-panel.tsx)

Hoje tem dois cartões (exportar / excluir). Passa a ter:

- **Exportar meus dados** (existente, com conteúdo completo)
- **Corrigir meus dados** — campos livres viram edição direta; e-mail e CPF
  abrem `lgpd_requests(kind='rectification')`
- **Com quem compartilhamos** (art. 18, VII) — tela estática listando operadores
- **Meus consentimentos** — lista de `consent_records` com botão de revogar
- **Solicitar exclusão** (existente) — passa a exibir **protocolo e prazo**
- **Minhas solicitações** — histórico com status

#### 2.2 Painel do admin — nova rota `/admin/lgpd`

- Fila de `lgpd_requests` ordenada por `due_at`, com destaque para as vencidas
- Ação "atender": dispara `anonymizeUser` ou gera export assinado
- Aba de consentimentos e aba de incidentes
- Badge de pendências no [sidebar do admin](../src/components/features/admin/sidebar.tsx)
- Alerta quando faltarem 5 dias ou menos para o prazo de 15 dias

#### 2.3 Canal público para quem não tem conta — `/privacidade/solicitacao`

Formulário público (nome, e-mail, tipo de pedido) com rate limit, criando
`lgpd_requests` com `requester_id = null`. Atende leads e responsáveis (L-15).
Verificação de identidade por e-mail de confirmação antes de atender.

---

### Fase 3 — Menores de idade · ~1 semana

1. `src/lib/lgpd/minors.ts` — `isChild(birthDate)` (menor de 12),
   `isAdolescent()` (12–17).
2. Convite de aluno menor exige `guardian_name`, `guardian_email` e
   `guardian_phone` **obrigatórios** e um `consent_records(purpose='guardian_minor')`.
3. **Verificação do responsável**: e-mail com link de confirmação para o
   `guardian_email` antes de ativar a conta (art. 14 §5, "esforço razoável").
   → **Depende de provedor de e-mail transacional, que hoje não existe** (ver §6).
4. Avatar de menor: consentimento separado do responsável antes do upload.
5. Seção dedicada na política sobre dados de crianças (art. 14 §6).
6. Formulário de aula experimental: quando `is_adult = false`, coletar o contato
   do responsável — não o do menor.

---

### Fase 4 — Documentação e governança · ~1 semana (jurídico + dev)

1. **Reescrever `/privacidade`** cobrindo tudo do §1 deste documento, com número
   de versão e data. Versionar o texto em `src/content/privacidade/v2.md` para
   que `consent_records.document_version` aponte para um conteúdo imutável.
2. **Reescrever `/termos`** da mesma forma.
3. **Publicar o encarregado**: `dpo@duingles.com.br` + nome, na política e no
   [footer](../src/components/features/marketing/footer.tsx).
4. **`docs/ropa.md`** — registro das operações de tratamento (art. 37), derivado
   da tabela do §1.2.
5. **`docs/runbook-incidente.md`** — quem detecta, quem decide, prazo de
   comunicação à ANPD, template de aviso ao titular.
6. **`docs/subprocessadores.md`** — Supabase, Vercel e Stripe: finalidade, país,
   salvaguarda, link do DPA.
7. **Assinar os DPAs** dos três operadores (art. 39). São autoatendimento nos
   três painéis.
8. **RIPD** (art. 38) — necessário pelo tratamento de dados de menores.

---

### Fase 5 — Refinamentos · contínuo

- Banner de cookies grava `consent_records` além do `localStorage`, e ganha
  botão "Recusar" + link para gerenciar (preparado para quando entrar analytics).
- Botão "solicitar revisão da correção" nas tarefas auto-corrigidas (art. 20) e
  texto explicando os critérios em
  [exercise-player.tsx](../src/components/features/assignments/exercise-player.tsx).
- Criptografia em coluna para `cpf` (`pgcrypto` / Vault do Supabase) — CPF em
  texto claro é o dado de maior impacto num vazamento.
- Avaliar se o CPF do **aluno** é mesmo necessário (minimização, art. 6 III) —
  se só serve para o contrato do responsável financeiro, coletá-lo só dele.
- Log de acesso a dados sensíveis (admin abrindo ficha de aluno) — hoje só
  escritas são auditadas.
- Retenção de gravações de aula (`recording_url`) — definir prazo.

---

## 5. Matriz de rastreabilidade

| Artigo LGPD | Exigência | Lacuna | Fase |
|---|---|---|---|
| Art. 6, III | Minimização | L-14 / CPF | 5 |
| Art. 7, I e art. 8 | Prova de consentimento | L-03 | 1 |
| Art. 9 | Informação ao titular | L-14 | 4 |
| Art. 14 | Dados de crianças e adolescentes | L-04 | 3 |
| Art. 15 e 16 | Término do tratamento e retenção | L-06 | 1 |
| Art. 18, II | Acesso | L-05 | 1 |
| Art. 18, III | Correção | L-12 | 2 |
| Art. 18, IV e VI | Anonimização / eliminação | L-02 | 1 |
| Art. 18, V | Portabilidade | L-05 | 1 |
| Art. 18, VII | Informação sobre compartilhamento | L-01 | 2 |
| Art. 18, IX | Revogação de consentimento | L-03 | 2 |
| Art. 19 | Prazo de 15 dias | L-01 | 1 e 2 |
| Art. 20 | Revisão de decisão automatizada | L-13 | 5 |
| Art. 33 | Transferência internacional | L-10 | 4 |
| Art. 37 | Registro das operações (ROPA) | L-16 | 4 |
| Art. 38 | RIPD | L-16 | 4 |
| Art. 39 | Contrato com operador (DPA) | L-10 | 4 |
| Art. 41 | Encarregado (DPO) | L-09 | 4 |
| Art. 46 | Segurança | ✅ atendido | — |
| Art. 48 | Comunicação de incidente | L-11 | 1 e 4 |

---

## 6. Dependências e riscos do plano

1. **Não existe provedor de e-mail transacional no projeto.** Verificado: sem
   Resend, SendGrid, nodemailer ou SMTP. Toda notificação é in-app (sino).
   Isso bloqueia: confirmação de consentimento do responsável (Fase 3), aviso de
   protocolo ao titular, verificação de identidade de titular sem conta (Fase 2)
   e comunicação de incidente (art. 48). **Contratar um provedor é pré-requisito
   das Fases 2 e 3**, não um detalhe.
2. **Prazos de retenção precisam de decisão jurídica** antes de o cron entrar —
   apagar cedo demais é tão problemático quanto tarde demais.
3. **`teacher_notes` no export do aluno** é decisão de negócio: expor pode inibir
   o registro pedagógico honesto; não expor exige fundamentar o art. 19 §1.
4. **Anonimização é irreversível.** O fluxo do admin precisa de dupla
   confirmação e de um período de carência (ex.: 7 dias) antes de executar.
5. As migrations locais começam em `0023` — as anteriores não estão no
   repositório. Confirmar em produção o estado real de RLS das tabelas antigas
   antes de escrever a `0041`.

---

## 7. Checklist de aceite

- [ ] Titular consegue baixar **todos** os seus dados, inclusive CPF e observações
- [ ] Titular recebe protocolo e prazo ao abrir qualquer requisição
- [ ] Admin vê fila de requisições com alerta de vencimento
- [ ] Exclusão remove de fato nome, e-mail, CPF, telefone, avatar e conta de auth
- [ ] Todo consentimento tem registro com IP, user-agent e versão do documento
- [ ] Nenhum lead é gravado sem checkbox marcado
- [ ] Menor de idade não conclui cadastro sem confirmação do responsável
- [ ] `purge_expired_personal_data` roda diariamente e a política descreve os
      mesmos prazos
- [ ] `audit_logs` grava IP e user-agent em toda ação
- [ ] Export gera entrada de auditoria e respeita rate limit
- [ ] Encarregado nomeado e publicado
- [ ] DPAs dos três operadores assinados e arquivados
- [ ] ROPA, RIPD e runbook de incidente versionados em `docs/`
