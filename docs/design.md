# Direção visual e critérios de interface

## Identidade observada

`src/app/globals.css` é a fonte dos tokens de cor e tipografia. A identidade
usa canvas branco, azul-marinho institucional e dourado como acento. O chrome
do painel administrativo usa dourado; as áreas de aluno/professor usam azul-
marinho. Há escalas de sucesso/aviso/erro e tokens para gráficos. Geist Sans e
Geist Mono são carregadas pelo layout raiz.

Os componentes compartilhados estão em `src/components/ui/`; componentes por
funcionalidade estão em `src/components/features/`. A interface é própria e
usa Tailwind CSS 4; shadcn/ui não está adotado e não deve ser introduzido como
efeito colateral de uma tarefa.

A folha da aula no editor (`.lesson-sheet`) tem largura fixa de 715,28px (= coluna
do PDF, 515pt) e usa a Inter do PDF (`public/fonts/lesson/`, cópia dos arquivos
de `src/lib/pdf/fonts/`, OFL), com pesos 400/700. Motivo: paridade de quebras de
linha entre editor e PDF. O resto da UI segue Geist. Imagens guardam o attr
`colWidth` para reescalar documentos antigos à folha. Em telas estreitas a folha
rola na horizontal; o modo apresentação continua em largura cheia.

## Critérios para novas interfaces

- Reusar tokens, componentes e padrões de navegação existentes antes de criar
  variantes ou abstrações.
- Preservar semântica HTML, navegação por teclado, foco visível, rótulos,
  mensagens de erro junto ao campo e estados de carregamento/vazio/sucesso.
- Verificar contraste, zoom, telas estreitas e conteúdo longo. Interações devem
  funcionar sem depender exclusivamente de cor, hover ou movimento.
- Respeitar `prefers-reduced-motion` e os mecanismos de desempenho já presentes
  antes de adicionar animações pesadas, canvas ou shaders.
- Manter a diferença de navegação admin versus aluno/professor sem duplicar o
  sistema de tokens compartilhado.

O catálogo visual é o que existe no código, não uma proposta de redesign. Para
mudanças de UI, conferir `src/app/globals.css`, componentes adjacentes e fluxo
real antes de decidir um novo padrão. O checklist de acessibilidade é um
critério de revisão; não há auditoria automatizada de navegador estabelecida
neste setup.
