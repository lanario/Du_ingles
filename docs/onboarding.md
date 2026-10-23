# Onboarding local

## Pré-requisitos

- Node.js 24 e npm (npm 11.13.0 foi observado neste ambiente; o projeto usa o
  lockfile npm como fonte reproduzível).
- Docker Desktop iniciado com daemon Linux para `npm run test:integration`.
- Projeto Supabase de desenvolvimento autorizado e chaves locais para iniciar
  os fluxos que dependem de Auth/Postgres. Não reutilize credenciais de
  produção.

## Preparar e iniciar

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Edite `.env.local` com valores de desenvolvimento. O arquivo `.env*` é
ignorado pelo Git. `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` são necessárias para os fluxos com Supabase;
`SUPABASE_SERVICE_ROLE_KEY`, `VIEW_AS_SECRET` e `TOKEN_ENCRYPTION_KEY` são
segredos apenas de servidor. Stripe e Google são opcionais conforme as notas
do próprio `.env.example`. Não compartilhe valores reais em tickets ou logs.

Abra <http://localhost:3000>. Use contas de teste e dados sintéticos. Não
execute carga contra serviços de produção.

## Banco e dados de teste

O banco é Supabase/Postgres e as migrations existentes são imperativas em
`supabase/migrations/`. O teste de integração usa Testcontainers para iniciar
um PostgreSQL 17 descartável e cobre uma migration/RLS específica; não executa
todas as migrations do projeto nem substitui Supabase local. Veja
[docs/testing.md](testing.md) para pré-condições e limites.

Antes de alterar schema, policies, Auth ou Storage, leia as skills Supabase e
consulte a documentação atual. Revise SQL e impacto antes de qualquer aplicação
em banco. Aplicar migrations em ambiente externo ou produção fica fora do
onboarding e exige autorização explícita.

## Resolução de problemas

- `npm ci`: confira versão de Node/npm e se o lockfile está coerente; não use
  `--force` nem `--legacy-peer-deps` para ocultar conflitos.
- Teste de integração: inicie Docker Desktop e verifique daemon/virtualização;
  ele cria container temporário, não banco Supabase de produção.
- Build/env: confira os nomes em `.env.example` sem registrar os valores.
- MCP Context7: `.codex/config.toml` é escopo de projeto; Codex só carrega
  configuração local para projeto confiável. Após confiar/abrir uma nova sessão,
  confirme a descoberta e faça consulta de documentação antes de tratá-lo como
  funcional. A configuração no disco não prova conexão ativa.
