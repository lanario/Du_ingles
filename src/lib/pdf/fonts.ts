import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Fontes e emojis do PDF.
 *
 * O react-pdf só traz as 14 fontes padrão do PDF (Helvetica etc.), que não têm
 * setas, caixas de seleção nem nada fora do Latin-1 — o caractere some ou vira
 * lixo. Inter cobre o alfabeto e os símbolos usados nas aulas e é próxima da
 * Geist da tela. Os arquivos moram em `./fonts` (OFL) e vão para o bundle do
 * servidor via `outputFileTracingIncludes` em `next.config.ts`.
 *
 * O itálico existe só no subconjunto latino (arquivo pequeno): as setas e
 * símbolos dentro de trecho em itálico são desenhados em fonte reta — ver
 * `renderMarks` em `tiptap-nodes.tsx`.
 *
 * Emoji não é fonte: o react-pdf troca cada emoji por uma imagem. A fonte das
 * imagens é o Twemoji, baixado no momento da geração.
 */

export const PDF_FONT = "Inter";
export const MONO_FONT = "Courier";

const fontsDir = path.join(process.cwd(), "src", "lib", "pdf", "fonts");
const file = (name: string) => path.join(fontsDir, name);

let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  registered = true;

  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: file("inter-400-normal.woff"), fontWeight: 400, fontStyle: "normal" },
      { src: file("inter-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
      { src: file("inter-700-normal.woff"), fontWeight: 700, fontStyle: "normal" },
      { src: file("inter-700-italic.woff"), fontWeight: 700, fontStyle: "italic" },
    ],
  });

  // Sem hifenização: o algoritmo padrão parte palavras em português no meio
  // de forma que não existe na tela.
  Font.registerHyphenationCallback((word) => [word]);

  Font.registerEmojiSource({
    format: "png",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/",
  });
}
