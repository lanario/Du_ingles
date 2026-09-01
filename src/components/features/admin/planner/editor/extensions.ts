"use client";

import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { LessonImageView } from "./lesson-image-view";
import { LessonTextBoxView } from "./lesson-text-box-view";

/**
 * Extensões próprias do canvas de aula. Os pacotes oficiais de cor, tamanho e
 * alinhamento não estão no projeto — e são três atributos, não três libs:
 * um mark `textStyle` (cor + corpo da fonte) e um atributo global de
 * alinhamento cobrem tudo que a barra de ferramentas oferece.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lessonTextStyle: {
      setTextColor: (color: string | null) => ReturnType;
      setFontSize: (size: string | null) => ReturnType;
    };
    lessonTextAlign: {
      setTextAlign: (align: LessonAlign) => ReturnType;
    };
    lessonTextBox: {
      insertTextBox: () => ReturnType;
    };
  }
}

export type LessonAlign = "left" | "center" | "right" | "justify";

export const FONT_SIZES = ["14", "16", "18", "20", "24", "30", "40"] as const;

/** Mark de estilo inline. Sem atributo nenhum ele se apaga sozinho. */
export const LessonTextStyle = Mark.create({
  name: "textStyle",
  priority: 101,

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attributes) =>
          attributes.color ? { style: `color: ${attributes.color}` } : {},
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) =>
          attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (element) =>
          (element as HTMLElement).hasAttribute("style") ? {} : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextColor:
        (color) =>
        ({ chain }) =>
          chain().focus().setMark("textStyle", { color }).run(),
      setFontSize:
        (size) =>
        ({ chain }) => {
          const fontSize = size === null ? null : `${size}px`;
          return chain().focus().setMark("textStyle", { fontSize }).run();
        },
    };
  },
});

/**
 * Alinhamento como atributo global dos blocos de texto — a alternativa
 * (envolver em um nó "alignment") quebraria listas e tabelas.
 */
export const LessonTextAlign = Extension.create({
  name: "lessonTextAlign",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote", "listItem", "taskItem"],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => element.style.textAlign || null,
            renderHTML: (attributes) =>
              attributes.textAlign
                ? { style: `text-align: ${attributes.textAlign}` }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (align) =>
        ({ commands }) => {
          const types = ["paragraph", "heading", "blockquote"];
          return types
            .map((type) => commands.updateAttributes(type, { textAlign: align }))
            .some(Boolean);
        },
    };
  },
});

/** Deslocamento vindo do HTML: valor ilegível vale zero, nunca `NaN`. */
function toOffset(value: string | null): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

/**
 * Objeto SOLTO na folha: ele não reserva linha nenhuma no fluxo do texto.
 *
 * Uma figura no fluxo empurra o parágrafo para baixo — é o comportamento certo
 * para uma imagem que ilustra o trecho. Mas assim que ela é arrastada para o
 * lado, a linha que ela ocupava continua lá, vazia, e a folha fica com um
 * buraco no meio do texto. Solto, o nó vira uma casca de altura zero e a
 * figura passa a flutuar por cima do papel: o texto se fecha em volta como se
 * ela não estivesse ali, que é o que se espera de uma imagem colada na folha.
 */
const freeAttribute = {
  default: false,
  parseHTML: (element: HTMLElement) => element.getAttribute("data-free") === "true",
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes["free"] ? { "data-free": "true" } : {},
};

/** Largura em pixels — do atributo `width` ou do estilo inline. */
function toWidth(element: HTMLElement): number | null {
  const value = element.getAttribute("width") ?? element.style.width;
  return value ? Number.parseInt(value, 10) || null : null;
}

/**
 * Imagem redimensionável e móvel. `width` guarda a largura em pixels escolhida
 * com o mouse, `align` decide de que lado ela ancora e `offsetX`/`offsetY`
 * guardam o quanto ela foi arrastada a partir dessa âncora — os quatro viajam
 * no documento, então a aula abre exatamente como foi montada, inclusive na
 * tela do aluno.
 */
export const LessonImage = Image.extend({
  // Sem arraste nativo do nó: ele competia com o redimensionamento pelos
  // cantos — o navegador iniciava um drag-and-drop no meio do arrasto, o nó
  // era reinserido e a largura voltava ao valor anterior. Quem move a imagem
  // é o node view, com deslocamento próprio (`offsetX`/`offsetY`).
  draggable: false,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => toWidth(element),
        renderHTML: (attributes) =>
          attributes.width ? { width: String(attributes.width) } : {},
      },
      free: freeAttribute,
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") ?? "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align ?? "center" }),
      },
      /**
       * Deslocamento livre a partir da âncora do alinhamento, em pixels. Ele
       * vira um `translate` no node view — e não uma margem — de propósito: a
       * figura anda pela folha sem empurrar o texto em volta, que é o que se
       * espera ao arrastar uma imagem com o mouse.
       */
      offsetX: {
        default: 0,
        parseHTML: (element) => toOffset(element.getAttribute("data-offset-x")),
        renderHTML: (attributes) =>
          attributes.offsetX ? { "data-offset-x": String(attributes.offsetX) } : {},
      },
      offsetY: {
        default: 0,
        parseHTML: (element) => toOffset(element.getAttribute("data-offset-y")),
        renderHTML: (attributes) =>
          attributes.offsetY ? { "data-offset-y": String(attributes.offsetY) } : {},
      },
      /** Só existe enquanto o upload está no ar; nunca vai para o HTML. */
      uploadId: { default: null, rendered: false },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(LessonImageView);
  },
}).configure({ inline: false, allowBase64: true });

export type LessonBoxTone = "card" | "note" | "plain";

export const BOX_TONES: { value: LessonBoxTone; label: string }[] = [
  { value: "card", label: "Cartão" },
  { value: "note", label: "Recado" },
  { value: "plain", label: "Sem moldura" },
];

/**
 * Caixa de texto: um bloco de texto que mora POR CIMA da folha, do tamanho e
 * no lugar que o professor quiser — para escrever ao lado de uma imagem,
 * legendar uma figura ou montar duas colunas sem tabela.
 *
 * Ela nasce solta (`free`), pelo mesmo motivo da imagem arrastada: uma caixa
 * que empurrasse o texto para baixo seria só um parágrafo com borda. Por
 * dentro é um documento comum (`block+`), então título, lista e negrito
 * funcionam ali como funcionam na folha; `isolating` mantém o Backspace na
 * primeira linha dentro da caixa em vez de dissolvê-la no parágrafo de cima.
 */
export const LessonTextBox = Node.create({
  name: "textBox",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  draggable: false,
  selectable: false,

  addAttributes() {
    return {
      width: {
        default: 260,
        parseHTML: (element) => toWidth(element) ?? 260,
        renderHTML: (attributes) =>
          attributes.width ? { width: String(attributes.width) } : {},
      },
      align: {
        default: "left",
        parseHTML: (element) => element.getAttribute("data-align") ?? "left",
        renderHTML: (attributes) => ({ "data-align": attributes.align ?? "left" }),
      },
      tone: {
        default: "card",
        parseHTML: (element) => element.getAttribute("data-tone") ?? "card",
        renderHTML: (attributes) => ({ "data-tone": attributes.tone ?? "card" }),
      },
      offsetX: {
        default: 0,
        parseHTML: (element) => toOffset(element.getAttribute("data-offset-x")),
        renderHTML: (attributes) =>
          attributes.offsetX ? { "data-offset-x": String(attributes.offsetX) } : {},
      },
      offsetY: {
        default: 0,
        parseHTML: (element) => toOffset(element.getAttribute("data-offset-y")),
        renderHTML: (attributes) =>
          attributes.offsetY ? { "data-offset-y": String(attributes.offsetY) } : {},
      },
      free: { ...freeAttribute, default: true },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-text-box]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-text-box": "" }), 0];
  },

  addCommands() {
    return {
      insertTextBox:
        () =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({
              type: "textBox",
              attrs: { width: 260, align: "left", tone: "card", free: true },
              content: [{ type: "paragraph" }],
            })
            .run(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(LessonTextBoxView);
  },
});
