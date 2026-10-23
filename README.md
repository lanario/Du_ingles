# Du Inglês

Plataforma web para gestão do ensino de inglês, com aulas ao vivo, nivelamento
CEFR de A1 a C2 e áreas para alunos, professores e administradores. O código
existente também inclui tarefas, planos de aula, agenda, progresso, mensagens,
relatórios e rotinas administrativas; veja [PRODUCT.md](PRODUCT.md) e
[docs/architecture.md](docs/architecture.md) para o escopo observado.

## Desenvolvimento local

Requisitos verificados neste projeto: Node.js 24, npm e, para testes de
integração, Docker Desktop com daemon Linux acessível.

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
# Preencha apenas as variáveis necessárias para o fluxo local autorizado.
npm run dev
```

Abra <http://localhost:3000>. Para verificar mudanças, consulte os comandos e
o significado de cada um em [docs/quality.md](docs/quality.md). O roteiro de
preparação, variáveis e banco está em [docs/onboarding.md](docs/onboarding.md).

## Mapa da documentação

- [PRODUCT.md](PRODUCT.md): produto e fatos observados; não define roadmap.
- [docs/architecture.md](docs/architecture.md): arquitetura e limites atuais.
- [docs/design.md](docs/design.md): identidade visual e critérios de interface.
- [docs/onboarding.md](docs/onboarding.md): ambiente local e primeiro uso.
- [docs/quality.md](docs/quality.md): verificações, auditoria e revisão.
- [docs/testing.md](docs/testing.md): detalhes operacionais dos testes e carga.
- [docs/setup.md](docs/setup.md): adoção do toolkit, fontes, decisões e evidências.
- [AGENTS.md](AGENTS.md): comandos, acordos e índice curto para agentes.
- [CLAUDE.md](CLAUDE.md): ponte existente para `AGENTS.md`.

## CI

O workflow em `.github/workflows/ci.yml` executa testes de arquitetura, unidade
e integração, lint, TypeScript e build em pull requests e pushes para `main`.
`npm audit` é informativo no CI; riscos encontrados localmente e pendências
estão registrados em [docs/quality.md](docs/quality.md).
