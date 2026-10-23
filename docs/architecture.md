# Arquitetura atual

## Stack confirmada

- Next.js 15 App Router, React 19, TypeScript e Tailwind CSS 4.
- npm com `package-lock.json`; runtime Node.js 24 observado no ambiente local e
  fixado também no workflow do GitHub Actions.
- Supabase Auth/Postgres com `@supabase/ssr`, `@supabase/supabase-js`, SQL
  versionado e políticas RLS. Não há ORM Drizzle.
- Zod para validação; Stripe e Google OAuth/Agenda são dependências/fluxos
  opcionais. O plano/plataforma de hospedagem não foi confirmado neste setup.

## Mapa de código

- `src/app/`: App Router. Route groups `(marketing)`, `(auth)`, `(admin)`,
  `(teacher)` e `(app)` organizam experiências; `api/` contém Route Handlers.
- `src/actions/`: Server Actions agrupadas por domínio/ator.
- `src/schemas/`: schemas de entrada e domínio.
- `src/repositories/`: acesso e consultas de dados.
- `src/services/`: operações de domínio que coordenam repositórios.
- `src/components/`, `src/hooks/`, `src/lib/`, `src/types/`: interface,
  comportamento compartilhado, integrações/utilitários e tipos.
- `supabase/migrations/`: 40 migrations existentes na data deste inventário.
- `tests/`, `tests/integration/`, `benchmarks/` e `loadtest/`: testes de
  arquitetura/unidade, integração PostgreSQL, benchmark de validação e scripts
  de carga HTTP.

## Limites e dados

O teste `tests/architecture.test.mjs` protege a direção das dependências:
`schemas` não importam camadas superiores; `repositories` não importam
`services`, interface nem `app`; `services` não importam interface nem `app`.
Novas dependências de fluxo devem respeitar essa regra e atualizar o teste se
um limite deliberadamente mudar.

Os clientes Supabase estão separados em `src/lib/supabase/server.ts`,
`browser.ts`, `admin.ts` e `public.ts`. Papéis e segurança dependem do controle
no servidor e das políticas RLS, não só da interface. O arquivo
`src/types/database.types.ts` contém tipos de banco. Não aplicar migrations,
alterar policies ou acessar serviços de produção como parte de um build/teste
local. Para qualquer trabalho Supabase, seguir `.agents/skills/supabase/SKILL.md`;
para mudanças PostgreSQL, seguir também
`.agents/skills/supabase-postgres-best-practices/SKILL.md`.

`src/middleware.ts` participa do controle por sessão e da CSP com nonce;
`next.config.ts` define headers de segurança e opções do Next que têm
justificativas de comportamento. Não alterar cache, CSP, Server Actions ou
fronteiras Server/Client sem verificar contratos e testes relevantes.

## Integrações

Há Route Handlers para uploads/arquivos, PDFs, sessões, exports, Stripe e
Google OAuth. `.env.example` descreve nomes e indica quais variáveis são
opcionais ou exclusivas do servidor. Os valores nunca devem ser copiados para
documentação, logs, prompts ou testes versionados. A existência de skills de
Vercel não confirma que Vercel seja o host ativo.
