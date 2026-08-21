"use client";

import type { Editor } from "@tiptap/react";

/**
 * Colar/soltar imagem no canvas. O caminho é sempre o mesmo:
 *
 *  1. reduz no navegador (uma foto de celular tem 4000 px de largura e a
 *     folha da aula tem 720 — subir o original é banda jogada fora);
 *  2. insere JÁ com o `data:` URL, para a imagem aparecer no instante do
 *     Ctrl+V, marcada com `uploadId`;
 *  3. envia o binário para `/api/lesson-assets/upload` e troca o `src` pelo
 *     caminho do Storage quando a resposta chega.
 *
 * Nada aqui pode ficar pendurado: qualquer falha limpa o `uploadId` (senão a
 * imagem fica com "enviando imagem…" para sempre) e devolve a mensagem para
 * a tela. A imagem continua no documento com o `data:` URL — perder o que o
 * professor acabou de colar seria pior do que um documento mais pesado.
 */

const UPLOAD_URL = "/api/lesson-assets/upload";
const MAX_SIDE = 1600;
const QUALITY = 0.85;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function isSupportedImage(file: File): boolean {
  return ACCEPTED.includes(file.type);
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode-failed"));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, QUALITY));
}

interface PreparedImage {
  /** O que entra no documento na hora, antes de o servidor responder. */
  previewUrl: string;
  /** O que sobe para o Storage. */
  blob: Blob;
  width: number;
}

/** GIF passa intacto: re-encodar em canvas mataria a animação. */
async function prepare(file: File): Promise<PreparedImage> {
  const original = await readAsDataUrl(file);
  const image = await loadImage(original);

  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  if (file.type === "image/gif" || (scale === 1 && file.size < 700_000)) {
    return { previewUrl: original, blob: file, width: image.naturalWidth };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return { previewUrl: original, blob: file, width: image.naturalWidth };

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  // PNG com transparência continua PNG; o resto vira JPEG, que é onde a
  // compressão realmente rende.
  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await canvasToBlob(canvas, mimeType);

  return {
    previewUrl: canvas.toDataURL(mimeType, QUALITY),
    blob: blob ?? file,
    width: canvas.width,
  };
}

/** Troca atributos do nó marcado com `uploadId` sem mexer no cursor. */
function patchImageNode(
  editor: Editor,
  uploadId: string,
  attributes: Record<string, unknown>,
) {
  if (editor.isDestroyed) return;
  const { state, view } = editor;
  let found: number | null = null;
  state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === "image" && node.attrs.uploadId === uploadId) found = pos;
    return true;
  });
  if (found === null) return;

  const node = state.doc.nodeAt(found);
  if (!node) return;
  view.dispatch(
    state.tr.setNodeMarkup(found, undefined, { ...node.attrs, ...attributes }),
  );
}

async function upload(
  blob: Blob,
  fileName: string,
  scope: string,
): Promise<{ url?: string; error?: string }> {
  const form = new FormData();
  form.append("file", blob, fileName);
  form.append("scope", scope);

  let response: Response;
  try {
    response = await fetch(UPLOAD_URL, { method: "POST", body: form });
  } catch {
    return { error: "Sem conexão com o servidor — a imagem não foi enviada." };
  }

  if (!response.ok) {
    const fallback = `Falha ao enviar a imagem (${response.status}).`;
    try {
      const body = (await response.json()) as { error?: string };
      return { error: body.error ?? fallback };
    } catch {
      return { error: fallback };
    }
  }

  try {
    const body = (await response.json()) as { url?: string };
    return body.url ? { url: body.url } : { error: "Resposta inesperada do servidor." };
  } catch {
    return { error: "Resposta inesperada do servidor." };
  }
}

export interface InsertImagesResult {
  inserted: number;
  errors: string[];
}

export async function insertImageFiles(
  editor: Editor,
  files: File[],
  scope: string,
): Promise<InsertImagesResult> {
  const images = files.filter(isSupportedImage);
  const errors: string[] = [];
  let inserted = 0;

  for (const file of images) {
    let prepared: PreparedImage;
    try {
      prepared = await prepare(file);
    } catch {
      errors.push(`Não consegui ler "${file.name}".`);
      continue;
    }

    const uploadId = crypto.randomUUID();
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: {
          src: prepared.previewUrl,
          alt: file.name.replace(/\.[^.]+$/, ""),
          width: Math.min(prepared.width, 720),
          align: "center",
          uploadId,
        },
      })
      .run();
    inserted += 1;

    const result = await upload(prepared.blob, file.name.slice(0, 120), scope);

    if (result.url) {
      patchImageNode(editor, uploadId, { src: result.url, uploadId: null });
    } else {
      // Sai do estado "enviando": a imagem fica utilizável mesmo sem o
      // Storage, e o erro aparece na barra do canvas.
      patchImageNode(editor, uploadId, { uploadId: null });
      errors.push(result.error ?? "Falha ao enviar a imagem.");
    }
  }

  if (files.length > images.length) {
    errors.push("Só PNG, JPG, WEBP e GIF podem ser colados na aula.");
  }

  return { inserted, errors };
}
