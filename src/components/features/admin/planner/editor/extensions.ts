"use client";

import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { LessonImageView } from "./lesson-image-view";

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
        parseHTML: (element) => {
          const value = element.getAttribute("width") ?? element.style.width;
          return value ? Number.parseInt(value, 10) || null : null;
        },
        renderHTML: (attributes) =>
          attributes.width ? { width: String(attributes.width) } : {},
      },
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
