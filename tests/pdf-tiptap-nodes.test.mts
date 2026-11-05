import test from "node:test";
import assert from "node:assert/strict";
import {
  COLUMN,
  PX,
  USABLE_HEIGHT,
  DEFAULT_COL_PX,
  FLOW_MAX_RATIO,
  imageGeometry,
  inferColPx,
  blockLineHeight,
  tableColumnWidths,
  estimateBlocksHeight,
  estimateTableHeight,
  estimateRowHeight,
  fitsOnPage,
} from "../src/lib/pdf/tiptap-nodes";
import { colWidthPatch } from "../src/components/features/admin/planner/editor/free-placement";

const wide = { width: 1000, height: 500 };
const base = { natural: wide, maxWidth: COLUMN };
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("colWidth 1100 escala a largura e o deslocamento para a coluna", () => {
  const g = imageGeometry({ ...base, attrWidth: 550, colWidth: 1100, free: true, offsetX: 110, offsetY: 55 });
  near(g.width, 550 * (COLUMN / 1100));
  near(g.top, 55 * (COLUMN / 1100));
  near(g.left, 110 * (COLUMN / 1100));
  assert.equal(g.flow, false);
});

test("doc sem colWidth mantém o comportamento antigo (PX)", () => {
  const g = imageGeometry({ ...base, attrWidth: 300, align: "left", free: true, offsetX: 100, offsetY: 50 });
  near(g.width, 300 * PX);
  near(g.left, 100 * PX);
  near(g.top, 50 * PX);
});

test("largura maior que a coluna é reduzida, não empurrada", () => {
  const g = imageGeometry({ ...base, attrWidth: 2000, align: "right", free: true });
  near(g.width, COLUMN);
  near(g.left, 0);
});

test("offsetY além da página manda a imagem solta para o fluxo", () => {
  const g = imageGeometry({ ...base, attrWidth: 400, free: true, offsetY: 5000 });
  assert.equal(g.flow, true);
});

test("offsetY negativo é preservado quando cabe", () => {
  const g = imageGeometry({ ...base, attrWidth: 400, free: true, offsetY: -20 });
  assert.equal(g.flow, false);
  assert.ok(g.top < 0);
});

test("maxWidth do contêiner (caixa de texto) é respeitado", () => {
  const g = imageGeometry({ ...base, attrWidth: 700, maxWidth: 200 });
  near(g.width, 200);
});

const imgDoc = (attrs: Record<string, unknown>) => ({
  type: "doc",
  content: [{ type: "image", attrs }],
});

test("doc antigo com imagem solta larga infere o papel e escala para caber", () => {
  const inferred = inferColPx(imgDoc({ width: 400, offsetX: 700, free: true }));
  near(inferred, 1100);
  const g = imageGeometry({ ...base, attrWidth: 400, offsetX: 700, free: true, inferredColPx: inferred });
  near(g.width, 400 * (COLUMN / 1100));
  assert.ok(g.left + g.width <= COLUMN + 1e-6);
});

test("doc antigo pequeno mantém o fallback", () => {
  near(inferColPx(imgDoc({ width: 300, offsetX: 100, free: true })), DEFAULT_COL_PX);
});

test("imagem com colWidth ignora o inferido", () => {
  const a = imageGeometry({ ...base, attrWidth: 550, colWidth: 1100, free: true, offsetX: 110 });
  const b = imageGeometry({ ...base, attrWidth: 550, colWidth: 1100, free: true, offsetX: 110, inferredColPx: 2000 });
  assert.deepEqual(a, b);
  near(inferColPx(imgDoc({ width: 900, offsetX: 900, free: true, colWidth: 1100 })), DEFAULT_COL_PX);
});

test("solta que passa da metade da página (y + altura) vai para o fluxo", () => {
  // largura 400 → altura 200 (proporção 2:1)
  const ok = imageGeometry({ ...base, attrWidth: 400, free: true, offsetY: 100 });
  assert.equal(ok.flow, false);
  const perto = imageGeometry({ ...base, attrWidth: 400, free: true, offsetY: 600 });
  assert.equal(perto.flow, true);
  const alta = imageGeometry({ natural: { width: 1000, height: 2000 }, maxWidth: COLUMN, attrWidth: 300, free: true });
  assert.equal(alta.flow, true);
});

test("imagem no fluxo tem a altura limitada a 0,7 da página, mantendo a proporção", () => {
  const g = imageGeometry({ natural: { width: 1000, height: 4000 }, maxWidth: COLUMN, attrWidth: 700 });
  near(g.height!, USABLE_HEIGHT * FLOW_MAX_RATIO);
  near(g.width, (USABLE_HEIGHT * FLOW_MAX_RATIO) / 4);
  const baixa = imageGeometry({ ...base, attrWidth: 400 });
  near(baixa.height!, baixa.width / 2); // 2:1, abaixo do teto
});

test("colWidthPatch reescala offsets por novo/antigo e omite colWidth nulo", () => {
  assert.deepEqual(colWidthPatch({ colWidth: 1000, offsetX: 100, offsetY: -50 }, 500), {
    colWidth: 500,
    offsetX: 50,
    offsetY: -25,
  });
  assert.deepEqual(colWidthPatch({ offsetX: 100, offsetY: 50 }, 800), { colWidth: 800 });
  assert.deepEqual(colWidthPatch({ colWidth: 1000, offsetX: 100 }, 1000), { colWidth: 1000 });
  assert.deepEqual(colWidthPatch({ colWidth: 1000, offsetX: 100 }, null), {});
});

test("blockLineHeight cresce a linha com o maior run, sem encolher", () => {
  near(blockLineHeight(1.75, 12, []), 1.75);
  near(blockLineHeight(1.75, 12, [9]), 1.75);
  near(blockLineHeight(1.75, 12, [24, 18]), (1.75 * 24) / 12);
});

test("tableColumnWidths estica e encolhe proporcionalmente até a largura útil", () => {
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const small = tableColumnWidths([100, 300], 400);
  near(sum(small), 400);
  near(small[1]! / small[0]!, 3);
  const big = tableColumnWidths([800, 800], 400);
  near(big[0]!, 200);
});

test("tableColumnWidths: sem colwidth colunas iguais; mistas usam a média", () => {
  assert.deepEqual(tableColumnWidths([null, null, null, null], 400), [100, 100, 100, 100]);
  const m = tableColumnWidths([100, null, 300], 600);
  near(m[1]! , m[0]! * 2);
  near(m[0]! + m[1]! + m[2]!, 600);
  assert.deepEqual(tableColumnWidths([], 400), []);
});

const P = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const row = (...cells: string[]) => ({
  type: "tableRow",
  content: cells.map((t) => ({ type: "tableCell", attrs: {}, content: [P(t)] })),
});

test("tabela curta cabe; tabela de poucas linhas muito altas não", () => {
  const short = { type: "table", content: [row("a", "b"), row("c", "d")] };
  assert.ok(fitsOnPage(estimateTableHeight(short, COLUMN, 11.5, 1.75)));
  const tall = { type: "table", content: [row("x ".repeat(2500), "y"), row("z", "w")] };
  assert.ok(!fitsOnPage(estimateTableHeight(tall, COLUMN, 11.5, 1.75)));
});

test("caixa de texto curta cabe; longa não", () => {
  assert.ok(fitsOnPage(estimateBlocksHeight([P("oi")], 200, 11, 1.6)));
  assert.ok(!fitsOnPage(estimateBlocksHeight([P("palavra ".repeat(1500))], 200, 11, 1.6)));
});

test("linha alta (mais de 0,9 página) deixa de ser indivisível; linha curta não", () => {
  const widths = [COLUMN / 2, COLUMN / 2];
  assert.ok(fitsOnPage(estimateRowHeight(row("a", "b"), widths, 11.5, 1.75)));
  assert.ok(!fitsOnPage(estimateRowHeight(row("x ".repeat(2500), "b"), widths, 11.5, 1.75)));
});
