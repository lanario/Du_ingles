# Teste de carga — Du Inglês

Scripts [k6](https://k6.io) para testar o sistema sob carga: Next.js 15 (App
Router) na Vercel + Supabase (Postgres/Auth/Realtime/Storage) + Stripe.

## ⚠️ Leia antes de rodar

Isto foi combinado para rodar **contra produção, fora do horário de aula**.
Isso só é seguro com estas regras:

1. **Nunca** use contas reais de alunos/professores/admins. Use contas de
   teste dedicadas (ver `data/test-users.example.json`).
2. **Nunca** exercite `/api/stripe/webhook` ou checkout — não há script aqui
   para isso, e não deve haver.
3. **Nunca** dispare convite ou recuperação de senha em massa — eles mandam
   e-mail de verdade. Não há script aqui para isso.
4. **Combine o horário com quem mais precisar saber** antes de rodar contra
   produção — mesmo fora de aula, é o banco e a infraestrutura real.
5. Rode o **smoke test primeiro** (poucos VUs) pra validar que os scripts
   autenticam e navegam certo antes de qualquer carga de verdade.
6. Se o teste vier de uma única máquina/IP, um pico repentino de centenas de
   conexões pode acionar proteção anti-bot da Vercel/Cloudflare *antes* de
   qualquer gargalo da aplicação aparecer — isso mediria a proteção de borda,
   não o app. Se os resultados parecerem estranhos demais (tudo 403/429 de
   uma vez), essa é a primeira suspeita.

## Pré-requisitos

- [k6](https://k6.io/docs/get-started/installation/) instalado:
  ```bash
  winget install k6.k6
  ```
- Para `scenarios/login-flow.js` (usa `k6/browser`): Chromium instalado e
  acessível — o k6 procura um Chrome/Chromium no sistema; se não achar, defina
  `K6_BROWSER_ARGS`/instale o Google Chrome normalmente.
- `SUPABASE_URL` e `SUPABASE_ANON_KEY` — os mesmos valores de
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` do `.env.local`
  (não são segredo, são as chaves públicas do client).

## Contas de teste

```bash
cp loadtest/data/test-users.example.json loadtest/data/test-users.json
```

Preencha com contas de teste reais (criadas à parte, com dados sintéticos —
turma/tarefas/mensagens de mentira, não de aluno real). Esse arquivo nunca
deve ser commitado (já está no `.gitignore`).

**Quantas contas você precisa:** menos do que o número de VUs. Várias VUs
podem compartilhar a mesma conta autenticada (isso é normal e realista pra
medir carga de banco/servidor) — 10–20 contas de aluno, 3–5 de professor e
1–2 de admin já bastam para os perfis de escala combinados (50–300 VUs).
Isso *não* testa unicidade por conta (ex.: dois logins "simultâneos" do
mesmo usuário) — só o throughput geral do backend.

**Para o cenário de PDF** (`scenarios/pdf-and-reports.js`), opcionalmente
informe o ID de uma aula já concluída com PDF gerado:

```bash
-e TEST_SESSION_ID_WITH_PDF=<uuid de class_sessions com pdf_path preenchido>
```

Sem isso, esse cenário testa só `/api/relatorios/export`.

## Rodando

### 1. Smoke test — valida os scripts, carga desprezível

```bash
k6 run -e SUPABASE_URL=https://qxkqndnvacwoqnvofsth.supabase.co \
        -e SUPABASE_ANON_KEY=<sua anon key> \
        -e MAX_VUS=6 -e RAMP_TIME=20s -e HOLD_TIME=40s -e RAMP_DOWN_TIME=10s \
        loadtest/main.js
```

Confira no resumo final: `checks` perto de 100% e nenhum erro de
autenticação no `setup()`. Se `checks` vier baixo, é sinal de sessão não
reconhecida (cookie) antes de qualquer coisa relacionada a carga — pare e
investigue antes de escalar.

### 2. Carga alvo (50–300 usuários simultâneos, combinado no planejamento)

```bash
k6 run -e SUPABASE_URL=https://qxkqndnvacwoqnvofsth.supabase.co \
        -e SUPABASE_ANON_KEY=<sua anon key> \
        -e MAX_VUS=150 -e RAMP_TIME=3m -e HOLD_TIME=8m -e RAMP_DOWN_TIME=2m \
        -e PDF_RPS=2 \
        --out json=loadtest/results/run-$(date +%Y%m%d-%H%M).json \
        loadtest/main.js
```

`MAX_VUS` é repartido ~70% aluno / ~20% professor / ~10% admin (ver
`main.js`). Suba em passos (ex.: 50 → 100 → 200 → 300 em execuções
separadas) em vez de já mirar 300 de primeira — assim dá pra ver *onde*
começa a degradar, não só *se* degrada.

### 3. Fluxo de login isolado (respeita o rate limit de 5 tentativas/15min)

```bash
k6 run -e SUPABASE_URL=https://qxkqndnvacwoqnvofsth.supabase.co \
        loadtest/scenarios/login-flow.js
```

## O que os scripts cobrem — e o que não cobrem

**Cobrem** (via HTTP direto, autenticando uma vez por VU contra a API do
Supabase e reaproveitando a sessão — ver `lib/auth.js`):
- Navegação autenticada de aluno, professor e admin pelas telas reais do
  painel (o middleware roda em cada uma — `getClaims()` contra o Supabase a
  cada request, um dos pontos de atenção do planejamento).
- `/api/sessions/[id]/pdf` (leitura de PDF do Storage) e
  `/api/relatorios/export` (CSV gerado na hora), isolados numa taxa fixa de
  requisições/segundo.
- O login real (`scenarios/login-flow.js`), via browser automatizado.

**Não cobrem:**
- **Server Actions de escrita** (criar tarefa, enviar mensagem, salvar plano
  de aula, etc.). Elas usam o protocolo interno de Server Actions do Next.js
  (header `Next-Action` com um ID que muda a cada build) — replicar isso via
  HTTP puro é frágil e quebraria a cada deploy. Se quiser cobrir esse tipo de
  escrita sob carga, os caminhos são: (a) estender `login-flow.js` com mais
  cenários de browser automatizado (mais fiel, mais lento/caro), ou (b)
  expor uma rota de API dedicada para teste, se fizer sentido no produto.
- **Realtime (websockets)** — chat, notificações e o `<LiveRefresh>` mantêm
  um canal Supabase aberto por sessão ativa. k6 não fala o protocolo do
  Supabase Realtime nativamente. Para ter visão de concorrência ali, observe
  a aba Realtime do dashboard do Supabase durante a janela do teste de carga
  (correlacione o horário com os VUs ativos do k6).
- **Upload de arquivo** (avatar, material de aula) — não incluído porque
  escrever em Storage de produção repetidamente é mais invasivo; se for
  testar, use um bucket/projeto Supabase de teste.

## O que observar durante o teste

- **Vercel** (Functions → Observability): duração das functions, taxa de
  erro, concorrência — é onde timeout/estouro de memória do PDF apareceria.
- **Supabase** (Dashboard → Database → Connection pooling / Reports): CPU,
  conexões ativas vs. limite do plano, queries lentas. É o ponto mais
  provável de saturar antes da CPU da Vercel, dado que cada Server
  Action/route handler abre um client Supabase.
- **k6**: no resumo final, olhe `http_req_duration` (p95/p99),
  `http_req_failed` e `checks` por tag de página (`page:dashboard`,
  `page:planejador`, etc.) — é o que aponta qual tela especificamente pesa
  mais, não só "o sistema" de forma genérica.

## Depois do teste

Escreva o achado principal (onde começou a degradar e qual métrica mostrou
isso primeiro — latência, erro, conexão de banco) antes de decidir o que
fortalecer. Suspeitas mais prováveis pela arquitetura atual, em ordem:
pool de conexões do Supabase, geração/leitura de PDF, e o
`getClaims()` do middleware em cada navegação.
