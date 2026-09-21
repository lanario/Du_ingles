import "server-only";
import { NextResponse } from "next/server";

/** `Verb To be — Exercises` → `verb-to-be-exercises`. */
export function pdfSlug(title: string, fallback: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || fallback
  );
}

/**
 * Entrega um PDF gerado na hora. `inline`: abre no visualizador do navegador,
 * de onde se imprime ou salva. Material privado — sem cache compartilhado.
 */
export function pdfResponse(buffer: Buffer, fileName: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
