<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Du Inglês

- Produto e limites: `PRODUCT.md`; mapa técnico: `docs/architecture.md`;
  interface: `docs/design.md`; ambiente: `docs/onboarding.md`; checks e riscos:
  `docs/quality.md`; inventário e setup de agentes: `docs/setup.md`.
- Stack observada: Next.js 15 / React 19 / TypeScript / Tailwind 4 / Supabase;
  preserve versões, npm, migrations, RLS e customizações existentes.
- Comandos: `npm ci`, `npm run dev`, `npm run lint`, `npm run typecheck`,
  `npm run test:architecture`, `npm run test:unit`,
  `npm run test:integration` (Docker) e `npm run build`. Benchmark: `npm run bench`.
  Não invente um script combinado que não existe.
- Antes de editar código Next.js, leia o guia pertinente em
  `node_modules/next/dist/docs/`. Se o diretório/guia estiver ausente, não altere
  código Next nessa tarefa; registre a limitação e continue partes independentes.
- Leia o código e critérios de aceite antes de agir. Preserve dados, contratos,
  autorização, testes, acessibilidade e trabalho local. Prefira a menor mudança
  verificável; não aplique migrations, consulte produção, publique ou faça
  deploy sem autorização específica.
- Para APIs/config de bibliotecas, use Context7 quando descoberto; senão,
  confirme em documentação oficial e anote a fonte. Nunca envie segredos/código
  privado em consultas.
- Supabase/Auth/RLS/Storage: carregar `.agents/skills/supabase/SKILL.md` antes
  do trabalho. Para schema/SQL/Postgres, carregar também
  `.agents/skills/supabase-postgres-best-practices/SKILL.md`.
- Skills locais disponíveis: `vercel-react-best-practices`,
  `vercel-composition-patterns`, `web-design-guidelines`, `writing-guidelines`,
  `vercel-react-view-transitions`, `vercel-optimize`, `deploy-to-vercel`,
  `vercel-cli-with-tokens`, `find-skills`, `gh-fix-ci`, `supabase` e
  `supabase-postgres-best-practices`. Descoberta não prova conexão/execução nem
  autoriza deploy, alteração externa ou mudança de provedor.
- `CLAUDE.md` importa estas instruções. Atualize os documentos responsáveis
  quando mudar comportamento, comandos, limites ou configuração; não duplique
  política entre arquivos.
- Não use `--force`/`--legacy-peer-deps` para contornar conflito de pacote.
  Mantenha `.env.local` e outros segredos fora do Git.
