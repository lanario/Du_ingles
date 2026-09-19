# Análise de performance — Du Inglês

> **Status (atualizado após a primeira rodada de implementação):** itens
> #1, #2 e #3 já foram implementados e medidos (ver notas "✅ Implementado"
> em cada seção). Itens #5, #6 e #7 seguem como estavam — deliberadamente não
> urgentes. Não houve verificação visual em navegador das telas autenticadas:
> o ambiente local aponta para o mesmo projeto Supabase de produção usado no
> `loadtest/`, e eu não tenho credenciais de login — a validação foi por
> `tsc --noEmit` + `eslint` limpos e revisão cuidadosa da lógica CSS/JS, não
> por clique real na tela. Vale um teste manual rápido do hover da sidebar e
> do sino de notificação antes de subir.

Varredura no código (não em produção — sem acesso a métricas reais de usuário, APM ou logs do Supabase). Baseada em: leitura do código-fonte, das migrations, do `next.config.ts`/`middleware.ts`, e em um **build de produção real** (`npm run build`) rodado durante esta análise, que é a fonte dos números de "First Load JS" abaixo.

**Contexto importante:** o projeto já tem um histórico consistente de trabalho de performance — `staleTimes` calibrado, RLS com InitPlan corrigido (`0044_rls_initplan.sql`), middleware enxuto (sem query ao banco na maior parte das rotas), modo leve para hardware fraco (`src/lib/perf.ts`), shader da landing carregado sob demanda e desligado em modo leve. Isso já elimina várias das causas mais comuns de lentidão. Os achados abaixo são o que sobrou depois disso — não repito o que já está resolvido.

---

## Resumo — por onde começar

| # | Achado | Impacto | Esforço | Status |
|---|--------|---------|---------|--------|
| 1 | `/api/avatars/[...path]` sem cache — 1 round-trip ao Storage por avatar exibido | Alto (listas com muitos alunos) | Baixo | ✅ Implementado |
| 2 | GSAP carregado sempre no shell autenticado (sidebar + sino de notificação) | Médio-Alto (todo mundo, toda página) | Médio | ✅ Implementado |
| 3 | Mensagens usa GSAP **e** Framer Motion juntos — rota mais pesada do sistema | Médio (quem usa o chat) | Médio | ✅ Implementado (−28 kB nas 3 rotas de mensagens) |
| 4 | Rotas com First Load JS entre 234–285 kB | Médio | Médio-Alto | Parcial — segue #2/#3 |
| 5 | Build de produção falhou silenciosamente (exit 0, sem gerar rotas) | Baixo hoje, alto se passar despercebido em CI | Baixo | Causa identificada (dev+build concorrendo no `.next`) |
| 6 | Listagens administrativas sem paginação (`listGroups`, `listAllGroups` etc.) | Baixo hoje, cresce com a base | Médio | Não iniciado — de propósito |
| 7 | `student_attendance_rate` chamado 1x por turma (N chamadas RPC em paralelo) | Baixo | Baixo | Não iniciado — de propósito |

---

## 1. Avatar sem cache — round-trip do Supabase Storage por imagem

**Onde:** [src/app/api/avatars/[...path]/route.ts](src/app/api/avatars/[...path]/route.ts), [src/lib/avatars.ts:97](src/lib/avatars.ts#L97)

Cada `<img src="/api/avatars/...">` dispara uma requisição HTTP própria que:
1. Reconfirma a sessão (`getSessionContext`, consulta a `profiles`);
2. Gera uma **signed URL nova** no Supabase Storage (`getAvatarSignedUrl`);
3. Responde com um redirect 307 para essa URL, com `Cache-Control: private, max-age=60`.

`getSessionContext` usa `cache()` do React, mas isso só deduplica chamadas *dentro do mesmo request* — cada avatar é um request HTTP separado do navegador, então o dedup não ajuda aqui. Numa tela como `turmas-view`, `students-view` ou a lista de participantes do chat, **N alunos = N verificações de sessão + N assinaturas de URL + N redirects**, todos síncronos do ponto de vista do navegador carregando a grade de fotos.

Com `max-age=60`, revisitar a mesma tela em menos de um minuto é servido do cache do navegador — mas a primeira carga de qualquer lista grande paga o custo inteiro, e ele se repete a cada 60s de uso contínuo do painel.

**Sugestões (não excludentes):**
- Aumentar `max-age` (o avatar muda raramente — 5–15 min já reduziria bastante a repetição) ou usar `stale-while-revalidate`.
- Memoizar a signed URL por `(orgId, userId, path)` por alguns minutos (ex.: `unstable_cache` ou um Map em memória com TTL) em vez de gerar uma nova a cada request.
- Avaliar se o bucket pode ter as fotos com nome não-adivinhável e ser servido via CDN/URL pública de longa duração, dispensando o proxy autenticado por imagem — dependeria de como está modelado o isolamento entre organizações hoje.

**✅ Implementado.** [src/lib/avatars.ts](src/lib/avatars.ts): `getAvatarSignedUrl` agora cacheia a signed URL em memória do processo por caminho (TTL de 270s, 30s de margem sob os 300s de validade do Storage — path é conteúdo-endereçado, então não há risco de servir foto desatualizada). `deleteAvatar` invalida a entrada. [route.ts](src/app/api/avatars/[...path]/route.ts): `Cache-Control` de `max-age=60` para `max-age=240`. Efeito esperado: N avatares na mesma instância aquecida colapsam em no máximo 1 chamada ao Storage por caminho distinto, em vez de N. Cache por processo (não compartilhado entre instâncias serverless) — ajuda o caso comum (instância já aquecida), não o cold start.

---

## 2. GSAP carregado incondicionalmente no shell autenticado

**Onde:** [src/components/features/app-sidebar.tsx:8](src/components/features/app-sidebar.tsx#L8), [src/components/features/admin/sidebar.tsx:8](src/components/features/admin/sidebar.tsx#L8), [src/components/features/notification-bell.tsx:15](src/components/features/notification-bell.tsx#L15)

`AppSidebar`/`AdminSidebar` são importados direto (sem `next/dynamic`) nos três layouts autenticados — [(admin)/layout.tsx](src/app/(admin)/layout.tsx), [(app)/layout.tsx](src/app/(app)/layout.tsx), [(teacher)/layout.tsx](src/app/(teacher)/layout.tsx) — e o sino de notificação também vive nesse shell. Como esses componentes importam `gsap` no topo do arquivo, **todo usuário autenticado baixa o GSAP em toda navegação**, independente de abrir ou não algo que anima com ele.

Isso contrasta com o cuidado já tomado em outros lugares do projeto (ex.: `shader-background.tsx` usando `next/dynamic` de propósito, com o comentário explicando o porquê). O mesmo raciocínio se aplica aqui: se a animação da sidebar/sino é um efeito de entrada pontual, ela é candidata a:
- Virar CSS/Tailwind (transição declarativa, zero JS), ou
- Ser importada via `next/dynamic` só no componente que efetivamente anima, carregado depois da hidratação inicial.

**Por que importa:** isso não é um custo isolado — ele soma com o achado #3 e explica boa parte dos números do achado #4.

**✅ Implementado.** [notification-bell.tsx](src/components/features/notification-bell.tsx): o balanço do sino, o "eco" de chegada e a respiração do halo viraram `@keyframes` em [globals.css](src/app/globals.css) (classes `animate-bell-ring`, `animate-bell-flash`, `animate-bell-breathe`), disparadas por toggle de classe em vez de tween. [app-sidebar.tsx](src/components/features/app-sidebar.tsx) e [admin/sidebar.tsx](src/components/features/admin/sidebar.tsx): a revelação em cascata dos rótulos (`[data-nav-label]`) também virou CSS, com o atraso de cada rótulo vindo de uma custom property (`--nav-i`); o brilho que segue o ponteiro no rail trocou `gsap.quickTo` por uma interpolação própria via `requestAnimationFrame` (função `createYFollower`, mesma ideia — suaviza rumo ao alvo mais recente — sem depender do GSAP). Nenhum dos três arquivos importa mais `gsap`. Efeito medido: ver achado #4 abaixo — nas rotas onde esses componentes eram a única fonte de GSAP, o ganho aparece; em rotas que ainda renderizam outro widget com GSAP (gráfico, modal de ficha), o chunk compartilhado continua carregando a lib por causa desse outro consumidor, então o número não muda até esses também serem convertidos.

---

## 3. Mensagens: GSAP *e* Framer Motion na mesma tela — maior bundle do sistema

**Onde:** [src/components/features/messaging/chat-thread.tsx:20-21](src/components/features/messaging/chat-thread.tsx#L20), `chat-composer.tsx`, `chat-list.tsx` (todos importam `gsap`; `chat-thread.tsx` importa `gsap` **e** `framer-motion` no mesmo arquivo, linhas 20-21).

`/mensagens`, `/admin/mensagens` e `/professor/mensagens` são, de longe, as rotas mais pesadas do build (ver tabela do achado #4 — 276–285 kB). Duas bibliotecas de animação completas fazendo, aparentemente, o mesmo tipo de trabalho (entrada/saída de mensagem, transição de lista) é peso duplicado por uma única finalidade.

**Sugestão:** escolher uma das duas para tudo o que é chat. `framer-motion` já está lá com `AnimatePresence` — cobre entrada/saída de itens de lista nativamente — então o caminho mais barato provavelmente é remover os usos de `gsap` dentro de `messaging/*` e ficar só com Framer Motion (ou vice-versa, se o GSAP estiver fazendo algo que o Framer não cobre bem, como scroll-to-bottom animado).

**✅ Implementado — GSAP removido dos três arquivos, Framer Motion ficou.** [chat-thread.tsx](src/components/features/messaging/chat-thread.tsx): o botão "ir para o fim" virou `data-visible` + transição CSS (era `gsap.to` com `autoAlpha`); o valor agora é derivado direto do render, sem efeito nem ref imperativa. [chat-composer.tsx](src/components/features/messaging/chat-composer.tsx): o bounce do botão de enviar virou `@keyframes chat-send-bounce` (aproxima o `elastic.out` original com um overshoot em keyframes), disparado por toggle de classe. [chat-list.tsx](src/components/features/messaging/chat-list.tsx): a cascata de entrada das linhas virou `@keyframes chat-row-in` aplicada direto por `[data-chat-row]`, com o índice de cada linha em `--i` — toca sozinha quando a linha *entra* no DOM (mount, ou volta a aparecer após um filtro) e nunca em uma linha só reordenada/atualizada, preservando a regra original ("só na montagem, para não piscar a cada mensagem nova"); o efeito de layout e o `useIsomorphicLayoutEffect` que existiam só para isso saíram inteiros. `prefers-reduced-motion` continua respeitado nos três — agora pela regra global do `globals.css`, sem checagem equivalente em JS.

**Medido:** rebuild limpo depois da mudança — `/mensagens` e `/professor/mensagens` caíram de 276 kB para 248 kB de First Load JS (−28 kB), `/admin/mensagens` caiu de 285 kB para 257 kB (−28 kB). É a maior queda de qualquer rota no sistema até agora.

---

## 4. Rotas com First Load JS pesado (medido em build real)

Rodei `npm run build` e capturei a tabela de "Route (app)" do Next. Baseline compartilhado por toda rota: **103 kB**. Como referência de bom senso (não é uma regra do Next, é heurística de mercado): acima de ~170–200 kB de First Load JS já é considerado pesado para uma tela visitada repetidamente — e o próprio projeto se preocupa explicitamente com "celular antigo, máquina de escola" (`src/lib/perf.ts`).

| Rota | First Load JS (antes) | Depois dos achados #2 e #3 |
|---|---|---|
| `/mensagens`, `/professor/mensagens` | 276 kB | **248 kB** |
| `/admin/mensagens` | 285 kB | **257 kB** |
| `/admin/planejador`, `/professor/planejador` | 270 kB | 270 kB |
| `/admin/turmas`, `/professor/turmas` | 238–248 kB | 238–248 kB |
| `/admin/agenda`, `/agenda`, `/professor/agenda` | 234 kB | 234 kB |
| `/` (landing) | 243 kB | 243 kB |
| `/admin/financeiro` | 243 kB | 243 kB |
| `/admin/planos-de-alunos`, `/admin/relatorios` | 239 kB | 239 kB |

As rotas de mensagens caíram porque o GSAP ali não tinha mais nenhum outro consumidor na página depois do achado #3. As demais não se moveram — não porque o achado #2 não tenha funcionado (a sidebar e o sino realmente não importam mais `gsap`), mas porque essas rotas ainda renderizam outro componente que importa GSAP diretamente (um gráfico, um modal de ficha, o editor do planejador): o chunk compartilhado da rota continua carregando a lib por causa *desse* consumidor. O ganho da sidebar/sino existe (menos uma fonte de acoplamento eager em toda tela autenticada) mas só vira número visível de bundle quando o último consumidor de GSAP daquela rota também for convertido — a lista de arquivos que ainda importam `gsap` diretamente está no achado #2 (comentário `import gsap from "gsap"` em ~20 arquivos restantes: gráficos do dashboard/relatórios, `plans-showcase.tsx`, modais de ficha, `planner-view.tsx`, componentes da vitrine pública). Continuar essa conversão arquivo a arquivo é trabalho de cauda longa — vale fazer sob demanda, não de uma vez.

O denominador comum das rotas do painel (mensagens, planejador, turmas, agenda) é: GSAP + ScrollTrigger importado em componentes que ficam no caminho crítico da tela (achados #2 e #3), mais os componentes de editor (Tiptap, canvas do planejador) — esses últimos já parcialmente resolvidos com `next/dynamic` (`tiptap-editor-dynamic.tsx`, `lesson-canvas-dynamic.tsx`), então o que resta puxando o peso é principalmente a camada de animação.

**A landing (`/`, 243 kB) merece atenção à parte:** é a única rota que anônimos e motores de busca veem, o peso de JS afeta Core Web Vitals/SEO diretamente (diferente das rotas internas, onde o usuário já está "dentro" do produto). Vale medir de novo depois de fechar a alteração em aberto em [hero.tsx](src/components/features/marketing/hero.tsx) (aparece modificado e não commitado no `git status` atual).

**Sugestão de verificação:** `next build` já imprime essa tabela — vale rodá-la periodicamente (ou plugar `@next/bundle-analyzer` uma vez) para não perder de vista se uma rota específica começa a crescer.

---

## 5. Build de produção falhou uma vez, silenciosamente

Na primeira execução de `npm run build` durante esta análise, o processo passou por "Collecting page data...", lançou:

```
unhandledRejection [Error [PageNotFoundError]: Cannot find module for page: /_document]
```

e **saiu com código 0** (sucesso) — mas `.next/server/app` ficou vazio: nenhuma rota foi de fato compilada. Depois de apagar `.next` e rodar de novo do zero, o build funcionou normalmente e gerou a tabela do achado #4.

**Atualização: reproduzido e a causa está identificada.** Durante a implementação dos achados #2 e #3, o mesmo padrão se repetiu — desta vez com `[Error [PageNotFoundError]: Cannot find module for page: /admin/usuarios]`, também com `Collecting page data` incompleto e exit code 0. As duas vezes em que isso aconteceu, o `next dev` (rodando no preview do navegador, para eu inspecionar as mudanças) estava ativo ao mesmo tempo que eu rodava `npm run build` na mesma pasta — e os logs do `next dev` nesse intervalo mostram exatamente o sintoma: `Caching failed for pack: Error: EPERM: operation not permitted, rename '...\.next\cache\webpack\...pack.gz_' -> '...pack.gz'`. Ou seja: **dev e build concorrendo pelo mesmo diretório `.next` no Windows corrompem a coleta de dados da build.** Parar o `next dev` antes de rodar `npm run build` eliminou o problema nas duas vezes que testei depois disso — build limpo, tabela de rotas completa, sem erro.

Isso não é um bug do Next em si, é um efeito colateral específico deste ambiente (dois processos Node escrevendo no mesmo cache em disco no Windows, onde `rename` sobre arquivo aberto é mais restritivo que em Unix). Ainda assim, o risco de processo do parágrafo original continua válido: **se um pipeline de CI/deploy compartilhar `.next` entre um processo de dev/watch e o build de produção — ou rodar builds em paralelo na mesma máquina —, o mesmo `exit code 0` silencioso pode acontecer lá.**

**Sugestão:** (a) nunca rodar `next dev` e `next build` apontando para o mesmo `.next` ao mesmo tempo — óbvio uma vez dito, mas vale documentar para quem for depurar isso de novo; (b) se o deploy for automatizado, adicionar uma checagem simples pós-build (ex.: `.next/server/app` não vazio, ou conferir se o `BUILD_ID` mudou) antes de promover a build, como rede de segurança contra qualquer outra causa do mesmo sintoma.

---

## 6. Listagens administrativas sem paginação

**Onde:** [src/repositories/groups.ts](src/repositories/groups.ts) — `listGroups` (linha 34), `listActiveGroups` (131), `listAllGroups` (145), entre outras — trazem a tabela inteira (`.order(...)` sem `.range()`/`.limit()`). Padrão parecido aparece em outros repositórios de listagem administrativa.

Hoje, com o volume de dados de uma escola pequena/média, isso não é um problema perceptível. Mas é o tipo de coisa que **não dá sintoma até dar**: o dia em que a organização passar de algumas centenas para milhares de turmas/alunos, essas telas passam a carregar tudo de uma vez, sem aviso prévio no código.

**Sugestão:** não é urgente — é para o radar. Quando/se o crescimento justificar, adicionar paginação (`.range()`) nas listagens administrativas mais visitadas (turmas, alunos, auditoria).

---

## 7. `student_attendance_rate`: uma chamada RPC por turma

**Onde:** [src/repositories/progress.ts:135-140](src/repositories/progress.ts#L135)

```ts
const groups: GroupProgress[] = await Promise.all(
  groupRows.map(async (row) => {
    const { data: rate } = await supabase.rpc("student_attendance_rate", {
      p_group: row.group!.id,
      p_student: studentId,
    });
    ...
```

Isso dispara uma chamada RPC por turma que o aluno cursa, em paralelo (`Promise.all` — não é sequencial, o que já evita o pior cenário). Para o caso comum (aluno em 1–3 turmas) é irrelevante. Só vira custo real se um aluno puder estar em muitas turmas simultaneamente — caso isso seja possível no produto, dá para trocar por uma única RPC que recebe a lista de turmas e devolve todas as taxas de uma vez.

---

## O que já está bem resolvido (não precisa de ação)

Registrando para não ser re-sugerido em uma próxima análise:

- **Middleware enxuto e documentado**: não consulta mais o banco na maioria das rotas, `getClaims()` valida o JWT localmente, `/api` está fora do matcher.
- **`staleTimes` calibrado** (120s dinâmico / 180s estático) com invalidação explícita via `revalidatePath` + `<LiveRefresh>` — decisão testada e documentada, incluindo por que `optimizePackageImports` foi descartado.
- **RLS sem InitPlan** (`0044`, `0045`) — `auth.uid()`/`is_admin()`/`auth_org()` embrulhados em `(select ...)`, evitando reavaliação por linha.
- **Modo leve** (`src/lib/perf.ts`) desliga `backdrop-filter`, sombra difusa e WebGL em hardware fraco, decidido antes do primeiro paint via script inline.
- **Shader da landing sob demanda**: `next/dynamic` com `ssr: false`, nunca baixado em modo leve, com fallback CSS estático cobrindo o LCP.
- **Editor de aula e Tiptap já divididos** via `next/dynamic` (`tiptap-editor-dynamic.tsx`, `lesson-canvas-dynamic.tsx`).
- **`sharp` instalado** — otimização de imagem em produção coberta caso o deploy não seja na Vercel.
- **Autosave com debounce (2s) + teto de espera (15s) + backoff em erro** — não faz um save a cada tecla.
- **Imagens em `public/`** já em WebP e leves (nenhuma passa de 90 KB).
- **`Promise.all` já usado** nos pontos mais críticos (`dashboard.ts`, parte de `progress.ts`, `reports.ts`) em vez de cadeias sequenciais de `await`.

---

## Observação metodológica

Esta análise é estática: não tenho acesso a métricas reais (Web Vitals de usuários, tempo de resposta do Supabase em produção, APM). Os achados #1, #2, #3 e #4 são fundamentados em leitura de código + números reais de build; #5 foi observado ao vivo durante esta sessão; #6 e #7 são avaliações de risco futuro, não problemas medidos hoje. Se houver acesso a algum painel de observabilidade (Vercel Analytics, Supabase Logs/Advisors, Sentry), vale cruzar com esta lista para confirmar quais desses pontos realmente aparecem como lentos na prática antes de investir tempo de desenvolvimento neles.
