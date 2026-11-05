import "server-only";
import sharp from "sharp";
import type { JSONContent } from "@tiptap/react";
import { getLessonAssetUrl, isValidAssetPath } from "@/lib/lesson-assets";

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
  let trusted = false;
  const assetPath = resolveAssetPath(src);
  if (assetPath !== null) {
    // Mesma regra da rota autenticada: só o material da própria escola.
    if (assetPath.split("/")[0] !== organizationId) return null;
    const signed = await getLessonAssetUrl(assetPath);
    if (!signed) return null;
    url = signed;
    trusted = true; // signed URL do nosso Storage
  } else if (!/^https?:\/\//i.test(src)) {
    return null;
  }

  return fetchBytes(url, trusted);
}

/**
 * Caminho do asset do Storage para `src` relativo ou URL absoluta do próprio
 * app (qualquer host: nunca é buscada, só o caminho é lido). `null` se não for.
 */
export function resolveAssetPath(src: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(src, "http://app.invalid").pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith(ASSET_PREFIX)) return null;
  try {
    const decoded = decodeURIComponent(pathname.slice(ASSET_PREFIX.length));
    return isValidAssetPath(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

const MAX_REDIRECTS = 3;

/**
 * URL externa vem do JSON do editor (editável): sem esta trava, o servidor
 * buscaria endereços internos (SSRF) ou baixaria arquivos gigantes.
 * Redirects são seguidos à mão para revalidar o host em cada salto.
 */
export async function fetchBytes(startUrl: string, trusted = false): Promise<Buffer | null> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(trusted && hop === 0) && isPrivateHost(url)) return null;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return null;
      let next: URL;
      try {
        next = new URL(location, url);
      } catch {
        return null;
      }
      if (next.protocol !== "http:" && next.protocol !== "https:") return null;
      url = next.href;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    if (Number(response.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
      await response.body?.cancel();
      return null;
    }
    return readCapped(response);
  }
  return null;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Lê o corpo em stream e aborta ao passar do teto (content-length pode faltar ou mentir). */
async function readCapped(response: Response): Promise<Buffer | null> {
  if (!response.body) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Localhost, IPs privados/loopback/link-local/CGNAT/benchmark e nomes sem ponto.
 * shortcut: checagem só textual do host, DNS rebinding não coberto; upgrade: validar IP via dns.lookup por salto
 */
export function isPrivateHost(rawUrl: string): boolean {
  let host: string;
  try {
    // ponto final (`localhost.`) é o mesmo host em DNS e escaparia dos checks
    host = new URL(rawUrl).hostname.toLowerCase().replace(/\.+$/, "");
  } catch {
    return true;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return true;
  }
  if (host.includes(":")) return true; // IPv6 literal: não vale o risco
  const parts = host.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n))) {
    const [a, b] = parts as [number, number, number, number];
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0 && parts[2] === 0)
    );
  }
  return !host.includes(".");
}

async function prepare(
  src: string,
  organizationId: string,
): Promise<PreparedImage | null> {
  try {
    const bytes = await readBytes(src, organizationId);
    if (!bytes || bytes.byteLength === 0) return null;

    // 64MP cobre foto de celular de 48MP; teto por memória (decodificação em Promise.all)
    const base = sharp(bytes, { animated: false, limitInputPixels: 64_000_000 }).rotate().resize({
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
