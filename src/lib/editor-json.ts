import type { JSONContent } from "@tiptap/core";

/**
 * Documento do Tiptap pronto para atravessar uma Server Action.
 *
 * O ProseMirror monta o `attrs` de cada nó com `Object.create(null)` — um
 * objeto sem protótipo. O serializador de Server Actions do React só
 * transporta objetos simples, e descarta esses SEM ERRO NENHUM: o cliente
 * envia `{ type: "image", attrs: { src: "…", width: 300 } }` e o servidor
 * recebe `{ type: "image" }`.
 *
 * Era isso que fazia a imagem colada sumir ao reabrir a aula. O nó continuava
 * no documento (por isso o espaço em branco ficava lá), mas sem `src` não há o
 * que desenhar — nem na tela, nem no PDF. E não era só imagem: alinhamento,
 * cor, corpo da fonte, largura de tabela e a posição das caixas de texto
 * viajam todos em `attrs`, e todos se perdiam do mesmo jeito.
 *
 * `JSON.parse(JSON.stringify(...))` reconstrói a árvore inteira com objetos
 * literais comuns, que é exatamente o que a serialização aceita. É a mesma
 * viagem que o documento já faz para virar `jsonb` no banco — só que agora
 * acontece antes de sair do navegador, e não depois de o dado ter sumido.
 *
 * Quem grava o documento por FormData (`JSON.stringify` no campo) nunca teve
 * esse problema: aquele caminho já normalizava sem querer.
 */
export function toPlainDocument(document: JSONContent): JSONContent {
  return JSON.parse(JSON.stringify(document)) as JSONContent;
}
