import "server-only";
import sharp from "sharp";
import type { JSONContent } from "@tiptap/react";
import { getLessonAssetUrl } from "@/lib/lesson-assets";

/**
 * Prepara as imagens da aula para o react-pdf.
 *
 * Por que isto existe: o `src` guardado no documento é um caminho RELATIVO
 * (`/api/lesson-assets/<org>/<escopo>/<arquivo>`), servido por uma rota que
 * exige sessão. O react-pdf roda no servidor, sem origem nem cookie — a
 * imagem simplesmente não carregava. Aqui o arquivo é lido direto do Storage
 * (bucket privado, chave de serviço), e o react-pdf só entende PNG e JPEG, então
 * WEBP e GIF passam por `sharp`. O resultado vai no próprio nó, em `attrs.__img`.
 */

const ASSET_PREFIX = "/api/lesson-assets/";
const MAX_SIDE = 1800;

export interface PreparedImage {
  data: Buffer;
  format: "png" | "jpg";
  width: number;
  height: number;
}

async function readBytes(
  src: string,
  organizationId: string,
): Promise<Buffer | null> {
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    if (comma < 0) return null;
    const meta = src.slice(0, comma);
    const body = src.slice(comma + 1);
    return meta.includes(";base64")
      ? Buffer.from(body, "base64")
      : Buffer.from(decodeURIComponent(body));
  }

  let url = src;
  if (src.startsWith(ASSET_PREFIX)) {
    const assetPath = decodeURIComponent(src.slice(ASSET_PREFIX.length).split("?")[0]!);
    // Mesma regra da rota autenticada: só o material da própria escola.
    if (assetPath.split("/")[0] !== organizationId) return null;
    const signed = await getLessonAssetUrl(assetPath);
    if (!signed) return null;
    url = signed;
  } else if (!/^https?:\/\//i.test(src)) {
    return null;
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function prepare(
  src: string,
  organizationId: string,
): Promise<PreparedImage | null> {
  try {
    const bytes = await readBytes(src, organizationId);
    if (!bytes || bytes.byteLength === 0) return null;

    const base = sharp(bytes, { animated: false }).rotate().resize({
      width: MAX_SIDE,
      height: MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    });
    const meta = await sharp(bytes).metadata();
    const keepAlpha = Boolean(meta.hasAlpha);

    const { data, info } = keepAlpha
      ? await base.png().toBuffer({ resolveWithObject: true })
      : await base.jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true });

    return {
      data,
      format: keepAlpha ? "png" : "jpg",
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    console.error("[pdf] imagem ignorada:", src.slice(0, 80), error);
    return null;
  }
}

/** Devolve uma cópia do documento com `attrs.__img` em cada imagem que carregou. */
export async function attachImages(
  doc: JSONContent,
  organizationId: string,
): Promise<JSONContent> {
  const cache = new Map<string, Promise<PreparedImage | null>>();

  async function visit(node: JSONContent): Promise<JSONContent> {
    const next: JSONContent = { ...node };

    if (node.type === "image" && typeof node.attrs?.["src"] === "string") {
      const src = node.attrs["src"] as string;
      let pending = cache.get(src);
      if (!pending) {
        pending = prepare(src, organizationId);
        cache.set(src, pending);
      }
      const image = await pending;
      next.attrs = { ...node.attrs, __img: image };
    }

    if (node.content) {
      next.content = await Promise.all(node.content.map(visit));
    }
    return next;
  }

  return visit(doc);
}

/** Último recurso quando o Twemoji não responde: tira os emojis do texto. */
export function stripEmoji(doc: JSONContent): JSONContent {
  const next: JSONContent = { ...doc };
  if (typeof next.text === "string") {
    next.text = next.text.replace(/[\p{Extended_Pictographic}‍️]/gu, "");
  }
  if (next.content) next.content = next.content.map(stripEmoji);
  return next;
}
