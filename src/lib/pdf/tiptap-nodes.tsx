import { Text, View, Link, Image, Svg, Path } from "@react-pdf/renderer";
import type { JSONContent } from "@tiptap/react";
import type { PreparedImage } from "@/lib/pdf/assets";
import { MONO_FONT, PDF_FONT } from "@/lib/pdf/fonts";

// O tipo de `style` de <Text>/<Link> é uma união com a variante SVG que o TS
// não resolve para um objeto montado aos poucos a partir das marks do Tiptap.
// Em tempo de execução é só um objeto plano — o cast em `S` é seguro.
type Style = Record<string, string | number | undefined>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver nota acima
const S = (style: Style): any => style;

/**
 * Mapeador Tiptap → react-pdf, medido pela folha da tela (`.lesson-sheet` em
 * `globals.css`): mesma escala de corpo, títulos, cores e molduras.
 *
 * A folha na tela é medida em pixels CSS; a página A4 útil tem ~515pt para
 * uma coluna de ~715px. `PX` converte um valor da tela em pontos do PDF, e é
 * por ele que passam larguras de imagem, deslocamentos e tamanhos de fonte.
 *
 * Imagens e caixas de texto SOLTAS (`free`) ficam em posição absoluta dentro
 * de uma âncora de altura zero, como na tela: elas flutuam sobre o papel sem
 * reservar linha, e o texto se fecha em volta.
 */

export const PX = 0.72;
/** Largura útil da coluna, em pontos (A4 = 595pt menos 2 × 40 de margem). */
export const COLUMN = 515;

const C = {
  foreground: "#0b1a33",
  navy900: "#0a1f44",
  navy800: "#0f2c5c",
  navy600: "#1c4c95",
  navy950: "#050f22",
  navy50: "#eef3fb",
  gold600: "#a8842a",
  gold500: "#c9a227",
  gold400: "#d9b45b",
  gold300: "#e7cd8c",
  gold50: "#fdf8ec",
  muted: "#f4f7fc",
  border: "#e3e9f3",
};

const BASE = 16 * PX; // 16px da tela
const LINE = 1.75;
/** `my-4` das imagens e caixas de texto no editor (16px). */
const MEDIA_MARGIN = 16 * PX;
/** `rounded-xl` (12px). */
const RADIUS_XL = 12 * PX;

/**
 * lineHeight (multiplicador do corpo) de um bloco. O react-pdf mede a linha pelo
 * fontSize do Text externo, então um run maior (marca de tamanho) invadiria a
 * linha seguinte; o CSS cresce a linha com o maior run, e aqui também.
 * Limite conhecido: eleva o parágrafo inteiro, não só a linha do run maior; um
 * run grande no meio deixa as demais linhas mais soltas que no editor.
 */
export function blockLineHeight(line: number, size: number, runSizes: number[]): number {
  const max = Math.max(size, ...runSizes);
  return max > size ? (line * max) / size : line;
}

/** Tamanhos (pt) das marcas `textStyle.fontSize` dos runs de um bloco. */
function runSizesOf(node: JSONContent, size: number): number[] {
  const out: number[] = [];
  for (const n of node.content ?? []) {
    for (const m of n.marks ?? []) {
      if (m.type === "textStyle" && m.attrs?.["fontSize"]) {
        out.push(fontSizeOf(m.attrs["fontSize"], size));
      }
    }
  }
  return out;
}

/**
 * Larguras das colunas (pt) normalizadas para `avail`: coluna sem largura gravada
 * vale a média das conhecidas (ou todas iguais); a soma estica ou encolhe até a
 * largura disponível, como `table { width: 100% }` do editor.
 */
export function tableColumnWidths(cols: (number | null)[], avail: number): number[] {
  if (!cols.length) return [];
  const known = cols.filter((c): c is number => c != null && c > 0);
  const fill = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  const raw = cols.map((c) => (c != null && c > 0 ? c : fill));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => (w / sum) * avail);
}

/** `colwidth` (px) por coluna, lido de qualquer linha; null onde nenhuma célula grava. */
function tableColumns(table: JSONContent): (number | null)[] {
  const cols: (number | null)[] = [];
  for (const row of table.content ?? []) {
    let c = 0;
    for (const cell of row.content ?? []) {
      const span = Math.max(1, Number(cell.attrs?.["colspan"]) || 1);
      const w = cell.attrs?.["colwidth"] as number[] | null | undefined;
      for (let k = 0; k < span; k++, c++) {
        if (cols[c] == null) cols[c] = Number(w?.[k]) > 0 ? Number(w?.[k]) : null;
      }
    }
  }
  return Array.from(cols, (c) => c ?? null);
}

interface Ctx {
  /** Corpo do texto do contêiner, em pontos. */
  size: number;
  /** Largura útil do contêiner, em pontos (limita imagens). Padrão: COLUMN. */
  maxWidth?: number;
  /** Largura do papel (px) inferida do doc para imagens sem `colWidth`. */
  inferredColPx?: number;
  /** Margem entre blocos irmãos, em em do corpo. Padrão 0,85 (folha); 0 em li/blockquote/td. */
  gap?: number;
  /** lineHeight do contêiner (padrão 1,75; caixa de texto 1,6). */
  line?: number;
  /** margin-top dos títulos, em em do próprio título; padrão por nível (caixa: 0,3). */
  headTop?: number;
  /** Cor do texto herdada (blockquote). */
  color?: string;
  /** Peso 700 herdado (th). */
  bold?: boolean;
}

const ROOT: Ctx = { size: BASE };

/** `"20px"` → pontos do PDF. */
function fontSizeOf(value: unknown, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const px = Number.parseFloat(value);
  if (!Number.isFinite(px) || px <= 0) return fallback;
  return value.endsWith("em") ? fallback * px : px * PX;
}

/** Cor só quando parece cor — um valor estranho não pode derrubar a geração. */
function safeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\([\d\s,.%]+\)$/i.test(value)
    ? value
    : undefined;
}

const ALIGN = {
  left: "left",
  center: "center",
  right: "right",
  justify: "justify",
} as const;

function alignOf(node: JSONContent): "left" | "center" | "right" | "justify" | undefined {
  const value = node.attrs?.["textAlign"];
  return typeof value === "string" && value in ALIGN
    ? ALIGN[value as keyof typeof ALIGN]
    : undefined;
}

/**
 * Trechos que a fonte itálica (subconjunto latino) não tem — setas, símbolos —
 * são desenhados em fonte reta, senão o caractere sumiria do PDF.
 */
const OUTSIDE_LATIN = /([^\u0000-ɏ‐-‧€]+)/;

function renderText(text: string, style: Style, italic: boolean) {
  if (!italic) return <Text style={S(style)}>{text}</Text>;
  return (
    <Text style={S(style)}>
      {text.split(OUTSIDE_LATIN).map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontStyle: "normal" }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

function renderInline(nodes: JSONContent[] = [], ctx: Ctx) {
  return nodes.map((node, i) => {
    if (node.type === "hardBreak") return "\n";
    if (node.type !== "text") return null;

    const style: Style = {};
    let href: string | undefined;
    let italic = false;
    const decorations: string[] = [];

    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case "bold":
          style["fontWeight"] = 700;
          break;
        case "italic":
          style["fontStyle"] = "italic";
          italic = true;
          break;
        case "underline":
          decorations.push("underline");
          break;
        case "strike":
          decorations.push("line-through");
          break;
        case "highlight":
          style["backgroundColor"] = safeColor(mark.attrs?.["color"]) ?? "#fef08a";
          break;
        case "code":
          style["fontFamily"] = MONO_FONT;
          style["backgroundColor"] = C.muted;
          style["fontSize"] = ctx.size * 0.9;
          break;
        case "textStyle": {
          const color = safeColor(mark.attrs?.["color"]);
          if (color) style["color"] = color;
          if (mark.attrs?.["fontSize"]) {
            style["fontSize"] = fontSizeOf(mark.attrs["fontSize"], ctx.size);
          }
          break;
        }
        case "link":
          href = typeof mark.attrs?.["href"] === "string" ? mark.attrs["href"] : undefined;
          break;
      }
    }

    if (href) {
      style["color"] ??= C.navy600; // cor própria do trecho vence a do link, como no editor
      decorations.push("underline");
    }
    if (decorations.length) style["textDecoration"] = [...new Set(decorations)].join(" ");

    const inner = renderText(node.text ?? "", style, italic);
    return href ? (
      <Link key={i} src={href} style={S({ color: C.navy600 })}>
        {inner}
      </Link>
    ) : (
      <Text key={i}>{inner}</Text>
    );
  });
}

/** Texto de um bloco; parágrafo vazio ocupa uma linha, como na tela. */
function textOf(node: JSONContent, ctx: Ctx) {
  return node.content?.length ? renderInline(node.content, ctx) : " ";
}

/** Uma imagem que não carregou vira um aviso discreto, nunca um buraco mudo. */
function Broken({ width }: { width: number }) {
  return (
    <View
      style={{
        width,
        padding: 8,
        border: `0.75pt dashed ${C.border}`,
        borderRadius: 4,
      }}
    >
      <Text style={{ fontSize: 9, color: "#94a3b8" }}>[imagem indisponível]</Text>
    </View>
  );
}

/** Largura do papel na tela (px) assumida para docs sem `colWidth`: a coluna do PDF em px. */
export const DEFAULT_COL_PX = COLUMN / PX;
/** Altura útil de uma página A4 em pt (842 − PAGE_TOP 36 − PAGE_BOTTOM 64) menos folga. */
export const USABLE_HEIGHT = 735;
/** Teto da altura de imagem no fluxo, como fração da altura útil. */
export const FLOW_MAX_RATIO = 0.7;

export interface ImageGeometryInput {
  attrWidth?: unknown;
  /** Largura útil do papel (px) quando width/offset foram gravados. */
  colWidth?: unknown;
  /** Largura do papel (px) usada quando o nó não tem `colWidth`; padrão DEFAULT_COL_PX. */
  inferredColPx?: number;
  offsetX?: unknown;
  offsetY?: unknown;
  align?: unknown;
  free?: boolean;
  /** Dimensões (px) da imagem preparada; null se não carregou. */
  natural: { width: number; height: number } | null;
  /** Largura útil do contêiner, em pt. */
  maxWidth: number;
  usableHeight?: number;
}

export interface ImageGeometry {
  width: number;
  height?: number;
  left: number;
  top: number;
  /** true: desenhar no fluxo (não é solta, ou a posição não cabe na página). */
  flow: boolean;
}

/**
 * Geometria da imagem em pt. Largura e deslocamentos da tela escalam por
 * COLUMN / colWidth (papel fluido na tela, coluna fixa no PDF); sem `colWidth`
 * vale o PX de sempre. A largura cede ao contêiner e a altura à página,
 * mantendo a proporção; solta que não cabe na página vai para o fluxo.
 */
export function imageGeometry(i: ImageGeometryInput): ImageGeometry {
  const col = Number(i.colWidth);
  const k = COLUMN / (Number.isFinite(col) && col >= 100 ? col : (i.inferredColPx ?? DEFAULT_COL_PX));
  const aw = Number(i.attrWidth);
  const nat = i.natural;
  let width = Math.min(
    Number.isFinite(aw) && aw > 0 ? aw * k : nat ? nat.width * PX : 240,
    i.maxWidth,
  );
  let height = nat ? (width * nat.height) / nat.width : undefined;
  const maxH = i.usableHeight ?? USABLE_HEIGHT;
  if (nat && height !== undefined && height > maxH) {
    height = maxH;
    width = (maxH * nat.width) / nat.height;
  }

  const x = (Number(i.offsetX) || 0) * k;
  const y = (Number(i.offsetY) || 0) * k;
  const anchor =
    i.align === "right"
      ? i.maxWidth - width
      : i.align === "center"
        ? (i.maxWidth - width) / 2
        : 0;
  const left = Math.min(Math.max(0, anchor + x), Math.max(0, i.maxWidth - width));
  // Altura desconhecida (aviso de erro): ~30pt.
  const h = height ?? 30;
  // shortcut: a posição da âncora na página é desconhecida; assume o pior e manda
  // para o fluxo qualquer solta que passe da metade da página (y + altura). Melhorar
  // quando a âncora for medida no layout (onRender) e comparada com a página real.
  const flow = !i.free || y + h > maxH * 0.5;
  // Retrato alto no fluxo (wrap={false}) salta de página e deixa a anterior vazia.
  if (flow && nat && h > maxH * FLOW_MAX_RATIO) {
    height = maxH * FLOW_MAX_RATIO;
    width = (height * nat.width) / nat.height;
  }
  return { width, height, left, top: y, flow };
}

/**
 * Papel mínimo (px) em que as imagens sem `colWidth` do doc cabem. Solta: o
 * offsetX é somado à âncora (esquerda 0, centro metade da sobra, direita 0), então
 * a esquerda precisa de offsetX+width e o centro de width+2*offsetX; à direita
 * só width (o offset positivo empurraria para fora, o limite da coluna cuida).
 */
export function inferColPx(doc: JSONContent): number {
  let max = DEFAULT_COL_PX;
  const walk = (n: JSONContent) => {
    const a = n.attrs;
    if (n.type === "image" && a && !(Number(a["colWidth"]) >= 100)) {
      const w = Number(a["width"]) || 0;
      const x = a["free"] ? Math.max(0, Number(a["offsetX"]) || 0) : 0;
      const need =
        a["align"] === "center" ? w + 2 * x : a["align"] === "right" ? w : w + x;
      if (need > max) max = need;
    }
    n.content?.forEach(walk);
  };
  walk(doc);
  return max;
}

function offsetOf(node: JSONContent) {
  const x = Number(node.attrs?.["offsetX"]) || 0;
  const y = Number(node.attrs?.["offsetY"]) || 0;
  return { x: x * PX, y: y * PX };
}

/**
 * Âncora de altura zero + objeto absoluto: reproduz `free` da tela. `left`
 * fica preso à coluna para o objeto não sair da página. `place` (imagens) traz
 * a posição já calculada; sem ela vale o cálculo das caixas de texto.
 */
function Floating({
  node,
  width,
  height,
  place,
  children,
}: {
  node: JSONContent;
  width: number;
  height?: number;
  place?: { left: number; top: number };
  children: React.ReactNode;
}) {
  const align = node.attrs?.["align"];
  const { x, y } = offsetOf(node);
  const anchor =
    align === "right"
      ? COLUMN - width
      : align === "center"
        ? (COLUMN - width) / 2
        : 0;
  const left = place?.left ?? Math.max(0, Math.min(COLUMN - width, anchor + x));
  const top = place?.top ?? Math.max(0, y);

  return (
    <View wrap={false} style={{ height: 0 }}>
      <View
        style={{
          position: "absolute",
          top,
          left,
          width,
          height,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function renderImage(
  node: JSONContent,
  key: number | string,
  maxWidth: number,
  inferredColPx?: number,
) {
  const img = node.attrs?.["__img"] as PreparedImage | null | undefined;
  const geo = imageGeometry({
    attrWidth: node.attrs?.["width"],
    colWidth: node.attrs?.["colWidth"],
    inferredColPx,
    offsetX: node.attrs?.["offsetX"],
    offsetY: node.attrs?.["offsetY"],
    align: node.attrs?.["align"],
    free: Boolean(node.attrs?.["free"]),
    natural: img ? { width: img.width, height: img.height } : null,
    maxWidth,
  });
  const { width, height } = geo;
  const body = img ? (
    // eslint-disable-next-line jsx-a11y/alt-text -- <Image> do react-pdf, não <img> do DOM
    <Image
      src={{ data: img.data, format: img.format }}
      style={{ width, height, borderRadius: RADIUS_XL }}
    />
  ) : (
    <Broken width={width} />
  );

  if (!geo.flow) {
    return (
      <Floating
        key={key}
        node={node}
        width={width}
        height={height}
        place={{ left: geo.left, top: geo.top }}
      >
        {body}
      </Floating>
    );
  }

  const align = node.attrs?.["align"];
  return (
    <View
      key={key}
      wrap={false}
      style={{
        alignItems:
          align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center",
      }}
    >
      {body}
    </View>
  );
}

const BOX_TONES: Record<string, Style> = {
  card: { border: `0.75pt solid ${C.border}`, backgroundColor: "#ffffff" },
  note: { border: `0.75pt solid ${C.gold300}`, backgroundColor: C.gold50 },
  plain: { border: "0.75pt solid transparent" },
};

function renderTextBox(node: JSONContent, key: number | string, ctx: Ctx) {
  const attrWidth = Number(node.attrs?.["width"]) || 260;
  const width = Math.min(attrWidth * PX, COLUMN);
  const tone = BOX_TONES[String(node.attrs?.["tone"])] ?? BOX_TONES["card"]!;
  const box = (
    <View
      style={S({
        ...tone,
        borderRadius: RADIUS_XL,
        paddingHorizontal: 14 * PX, // px-3.5
        paddingVertical: 10 * PX, // py-2.5
        width,
      })}
    >
      {renderBlocks(node.content, {
        // .lesson-text-box-body: 0.95em, line-height 1.6, 0.4em entre blocos
        size: BASE * 0.95,
        line: 1.6,
        gap: 0.4,
        headTop: 0.3,
        inferredColPx: ctx.inferredColPx,
        maxWidth: Math.max(20, width - 28 * PX - 1.5),
      })}
    </View>
  );

  if (node.attrs?.["free"] === false) {
    // Caixa maior que ~0,9 página quebra no fluxo em vez de ser cortada.
    const fits = fitsOnPage(estimateBlocksHeight(node.content, width - 28 * PX, BASE * 0.95, 1.6) + 20 * PX);
    return (
      <View key={key} wrap={!fits}>
        {box}
      </View>
    );
  }
  return (
    <Floating key={key} node={node} width={width}>
      {box}
    </Floating>
  );
}

/**
 * Blocos irmãos: `.lesson-sheet > * + *` dá 0,85em só no filho direto da folha
 * (`ctx.gap`); imagem e caixa têm `my-4` próprio. Margens verticais colapsam
 * (máximo), não somam.
 */
function renderBlocks(nodes: JSONContent[] | undefined, ctx: Ctx) {
  const gap = (ctx.gap ?? 0.85) * ctx.size;
  let prev: "flow-media" | "free" | null = null;
  return (nodes ?? []).map((child, i) => {
    const el = renderNode(child, i, ctx);
    if (el == null) return null;
    const isHeading = child.type === "heading";
    // Título tem a própria margem superior (em do próprio corpo); nó solto
    // não ocupa linha, então não empurra o irmão seguinte.
    const free = child.type === "textBox" || (child.type === "image" && child.attrs?.["free"]);
    const media = child.type === "textBox" || child.type === "image";
    const own = media ? MEDIA_MARGIN : i === 0 || isHeading ? 0 : gap;
    // Após solto, a margem da âncora (altura 0) já colapsou com a do irmão.
    const marginTop =
      prev === "free" ? 0 : Math.max(own, prev === "flow-media" ? MEDIA_MARGIN : 0);
    prev = free ? "free" : media ? "flow-media" : null;
    // Camada: o react-pdf pinta por último os irmãos SEM zIndex (sortZIndex põe os
    // com zIndex antes). Os blocos normais levam zIndex 1 e o wrapper do solto
    // fica sem, então imagem/caixa solta pinta por cima do texto, como na tela.
    return (
      <View
        key={i}
        style={{
          marginTop,
          flexShrink: 0, // senão o yoga espreme o bloco (tabela) no pé da página
          ...(free ? null : { zIndex: 1 }),
        }}
      >
        {el}
      </View>
    );
  });
}

function heading(node: JSONContent, key: number | string, ctx: Ctx, first: boolean) {
  const level = (node.attrs?.["level"] as number) ?? 1;
  const em = level === 1 ? 2 : level === 2 ? 1.45 : 1.15;
  const size = ctx.size * em;
  return (
    <Text
      key={key}
      style={S({
        fontSize: size,
        fontWeight: 700,
        // o CSS não define line-height em h1-h3: herda o da folha/caixa
        lineHeight: blockLineHeight(ctx.line ?? LINE, size, runSizesOf(node, size)),
        letterSpacing: level === 1 ? -0.02 * size : undefined,
        color: level === 1 ? C.navy900 : C.navy800,
        textAlign: alignOf(node),
        marginTop: first ? 0 : size * (ctx.headTop ?? (level === 2 ? 1.2 : 1.1)),
      })}
    >
      {textOf(node, { size })}
    </Text>
  );
}

/**
 * Caixa do item de tarefa: o `<input type=checkbox>` do editor tem accent gold-500.
 * ☐/☑ não existem na fonte, então a caixa é desenhada (View + Svg). O editor não
 * risca nem esmaece o texto concluído.
 */
function TaskBox({
  checked,
  size,
  top,
  gap,
}: {
  checked: boolean;
  size: number;
  top: number;
  gap: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        marginTop: top,
        marginRight: gap,
        flexShrink: 0,
        borderWidth: 1,
        borderColor: C.gold500,
        borderRadius: 2.5,
        backgroundColor: checked ? C.gold500 : "#ffffff",
      }}
    >
      {checked ? (
        <Svg viewBox="0 0 10 10" style={{ width: size - 2, height: size - 2 }}>
          <Path
            d="M2 5.2 L4.2 7.4 L8 2.8"
            stroke="#ffffff"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  );
}

function renderList(node: JSONContent, key: number | string, ctx: Ctx) {
  const ordered = node.type === "orderedList";
  const task = node.type === "taskList";
  const start = Number(node.attrs?.["start"]) || 1;

  // Tarefa: ul com padding .2em, caixa nativa (~13px) + gap .6em; as demais, 1.4em.
  const boxW = 13 * PX;
  const indent = task ? ctx.size * 0.2 + boxW + ctx.size * 0.6 : ctx.size * 1.4;
  const listPadding = task ? ctx.size * 0.2 : ctx.size * 0.3;
  const line = ctx.line ?? LINE;
  const itemWidth = Math.max(20, (ctx.maxWidth ?? COLUMN) - listPadding - indent);

  return (
    <View key={key} style={{ paddingLeft: listPadding }}>
      {node.content?.map((item, i) => {
        const marker = task ? null : ordered ? `${start + i}.` : "•";
        return (
          <View
            key={i}
            wrap={
              !canKeepListItemTogether(
                item.content,
                itemWidth,
                ctx.size,
                line,
                i === 0 ? 0 : ctx.size * 0.25,
              )
            }
            style={{ flexDirection: "row", marginTop: i === 0 ? 0 : ctx.size * 0.25 }}
          >
            {marker === null ? (
              <TaskBox
                checked={Boolean(item.attrs?.["checked"])}
                size={boxW}
                top={ctx.size * 0.45}
                gap={ctx.size * 0.6}
              />
            ) : (
              <Text
                style={S({
                  width: ctx.size * 1.1,
                  fontSize: ctx.size,
                  lineHeight: line,
                  color: C.gold600,
                })}
              >
                {marker}
              </Text>
            )}
            <View style={{ flex: 1 }}>
              {renderBlocks(item.content, {
                ...ctx,
                gap: 0, // dentro de li o editor não aplica `> * + *`
                maxWidth: (ctx.maxWidth ?? COLUMN) - indent,
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Fração da altura útil acima da qual um bloco indivisível (wrap={false}) deixa de caber. */
const NO_WRAP_RATIO = 0.9;

/**
 * Altura estimada (pt) de blocos de texto numa largura `width`, sem medir fonte.
 * shortcut: largura média de glifo = 0,5 × corpo e imagem = 150pt fixos; erra
 * para mais ou menos nas bordas. Trocar por medição do react-pdf se tabelas
 * perto do limite começarem a ser cortadas ou quebradas sem necessidade.
 */
export function estimateBlocksHeight(
  nodes: JSONContent[] | undefined,
  width: number,
  size: number,
  line: number,
): number {
  let h = 0;
  for (const n of nodes ?? []) {
    if (n.type === "image") {
      h += 150;
    } else if (n.type === "paragraph" || n.type === "heading") {
      const chars = (n.content ?? []).reduce((a, c) => a + (c.text?.length ?? 0), 0);
      const lines = Math.max(1, Math.ceil((chars * 0.5 * size) / Math.max(20, width)));
      h += lines * size * line;
    } else if (n.type === "table") {
      h += estimateTableHeight(n, width, size, line);
    } else {
      h += estimateBlocksHeight(n.content, width - size * 2, size, line);
    }
  }
  return h;
}

/** Altura estimada (pt) de uma linha de tabela: a maior célula + padding vertical. */
export function estimateRowHeight(row: JSONContent, widths: number[], size: number, line: number): number {
  let col = 0;
  let tallest = 0;
  for (const cell of row.content ?? []) {
    const span = Math.max(1, Number(cell.attrs?.["colspan"]) || 1);
    const w = widths.slice(col, col + span).reduce((a, b) => a + b, 0);
    col += span;
    tallest = Math.max(tallest, estimateBlocksHeight(cell.content, w - 2 * size * 0.7, size, line));
  }
  return tallest + size;
}

/** Altura estimada (pt) da tabela: soma das linhas. */
export function estimateTableHeight(table: JSONContent, avail: number, size: number, line: number): number {
  const widths = tableColumnWidths(tableColumns(table), avail);
  return (table.content ?? []).reduce((sum, row) => sum + estimateRowHeight(row, widths, size, line), 0);
}

/** Cabe inteiro numa página? Só então o bloco pode usar wrap={false}. */
export function fitsOnPage(estimate: number): boolean {
  return estimate <= USABLE_HEIGHT * NO_WRAP_RATIO;
}

/**
 * Texto simples fica junto para preservar o marcador; conteúdo longo ou
 * composto pode quebrar entre páginas. `wrap={false}` numa View maior que a
 * página faz o react-pdf comprimir seus filhos e sobrepor linhas.
 */
export function canKeepListItemTogether(
  nodes: JSONContent[] | undefined,
  width: number,
  size: number,
  line: number,
  spacing = 0,
): boolean {
  // Só estimamos blocos de texto simples. Cabeçalhos grandes, quebras manuais,
  // mídia, tabelas e caixas têm geometria própria; deixá-los quebráveis evita
  // que uma estimativa otimista os comprima dentro de uma View indivisível.
  const simpleText = (nodes ?? []).every(
    (node) =>
      node.type === "paragraph" &&
      !runSizesOf(node, size).some((run) => run > size) &&
      (node.content ?? []).every((inline) => inline.type === "text"),
  );
  if (!simpleText) return false;

  const contentHeight = estimateBlocksHeight(nodes, width, size, line);
  return fitsOnPage(Math.max(contentHeight, size * line) + spacing);
}

const SHORT_TABLE_ROWS = 10;

function renderTable(node: JSONContent, key: number | string, ctx: Ctx) {
  const avail = ctx.maxWidth ?? COLUMN;
  const widths = tableColumnWidths(tableColumns(node), avail);
  const padX = ctx.size * 0.7;
  return (
    // shortcut: tabela curta nunca parte (o react-pdf a espreme no pé da página quando
    // parte); a longa parte entre linhas. Revisar se a longa também espremer.
    <View
      key={key}
      wrap={(node.content?.length ?? 0) > SHORT_TABLE_ROWS || !fitsOnPage(estimateTableHeight(node, avail, ctx.size, ctx.line ?? LINE))}
      style={{ width: avail, flexShrink: 0 }}
    >
      {node.content?.map((row, i) => {
        let col = 0;
        return (
          // flexShrink 0: sem isso o yoga espreme linhas/células no pé da página
          <View
            key={i}
            // Linha maior que ~0,9 página precisa quebrar, senão o react-pdf a corta.
            wrap={!fitsOnPage(estimateRowHeight(row, widths, ctx.size, ctx.line ?? LINE))}
            style={{ flexDirection: "row", flexShrink: 0 }}
          >
            {row.content?.map((cell, j) => {
              const header = cell.type === "tableHeader";
              const span = Math.max(1, Number(cell.attrs?.["colspan"]) || 1);
              const w = widths.slice(col, col + span).reduce((a, b) => a + b, 0);
              col += span;
              return (
                <View
                  key={j}
                  style={S({
                    width: w,
                    flexGrow: 0,
                    flexShrink: 0,
                    border: `0.75pt solid ${C.border}`,
                    marginLeft: j === 0 ? 0 : -0.75,
                    marginTop: i === 0 ? 0 : -0.75,
                    paddingVertical: ctx.size * 0.5,
                    paddingHorizontal: padX,
                    backgroundColor: header ? C.navy50 : undefined,
                  })}
                >
                  {renderBlocks(cell.content, {
                    ...ctx,
                    gap: 0, // dentro de td o editor não aplica `> * + *`
                    bold: header,
                    maxWidth: Math.max(20, w - 2 * padX - 1.5),
                  })}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export function renderNode(
  node: JSONContent,
  key: number | string,
  ctx: Ctx = ROOT,
): React.ReactNode {
  switch (node.type) {
    case "doc":
      return (
        <View key={key} style={{ flexShrink: 0 }}>
          {renderBlocks(node.content, { ...ctx, inferredColPx: inferColPx(node) })}
        </View>
      );

    case "paragraph":
      return (
        <Text
          key={key}
          style={S({
            fontSize: ctx.size,
            lineHeight: blockLineHeight(ctx.line ?? LINE, ctx.size, runSizesOf(node, ctx.size)),
            color: ctx.color ?? C.foreground,
            fontWeight: ctx.bold ? 700 : undefined,
            textAlign: alignOf(node),
          })}
        >
          {textOf(node, ctx)}
        </Text>
      );

    case "heading":
      return heading(node, key, ctx, false);

    case "bulletList":
    case "orderedList":
    case "taskList":
      return renderList(node, key, ctx);

    case "blockquote":
      return (
        <View
          key={key}
          style={S({
            borderLeft: `2.25pt solid ${C.gold400}`,
            backgroundColor: C.gold50,
            borderTopRightRadius: 6,
            borderBottomRightRadius: 6,
            paddingVertical: ctx.size * 0.6,
            paddingHorizontal: ctx.size,
          })}
        >
          {renderBlocks(node.content, {
            ...ctx,
            gap: 0,
            color: C.navy800,
            maxWidth: (ctx.maxWidth ?? COLUMN) - ctx.size * 2 - 2.25,
          })}
        </View>
      );

    case "textBox":
      return renderTextBox(node, key, ctx);

    case "codeBlock":
      return (
        <View
          key={key}
          style={{
            backgroundColor: C.navy950,
            borderRadius: 12 * PX, // 0.75rem
            paddingVertical: ctx.size, // 1em 1.2em
            paddingHorizontal: ctx.size * 1.2,
          }}
        >
          <Text
            style={{
              fontFamily: MONO_FONT,
              fontSize: ctx.size * 0.9,
              lineHeight: (ctx.line ?? LINE) / 0.9, // herda a linha do bloco (em pt do <pre>)
              color: "#eaf0fa",
            }}
          >
            {node.content?.map((n) => n.text).join("") || " "}
          </Text>
        </View>
      );

    case "horizontalRule":
      return (
        <View
          key={key}
          style={{
            borderTop: `0.75pt solid ${C.border}`,
            marginVertical: ctx.size * 0.8,
          }}
        />
      );

    case "table":
      return renderTable(node, key, ctx);

    case "image":
      return node.attrs?.["src"] ? renderImage(node, key, ctx.maxWidth ?? COLUMN, ctx.inferredColPx) : null;

    default:
      return null;
  }
}

/** Fonte-base do documento; exportada para o cabeçalho usar a mesma família. */
export const BODY_FONT = PDF_FONT;
