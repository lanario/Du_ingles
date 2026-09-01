import { Text, View, StyleSheet, Link, Image } from "@react-pdf/renderer";
import type { JSONContent } from "@tiptap/react";

// @react-pdf/renderer não reexporta o tipo `Style` no nível superior, e o
// tipo de `style` de <Text>/<Link> é uma união com a variante SVG (por
// causa de SVGTextProps) que o TS não resolve limpo pra um objeto de estilo
// montado incrementalmente a partir das marks do Tiptap. Monta como objeto
// solto; em tempo de execução é só um objeto plano, o `any` no cast abaixo
// é seguro.
type MutableStyle = Record<string, string | number>;

/**
 * Mapeador Tiptap → react-pdf. `jsPDF` foi descartado de propósito
 * (posiciona por coordenada absoluta — sobrepõe conteúdo de altura
 * variável); react-pdf faz layout flexbox com quebra de página automática
 * (§8.4). Cobre só os nós usados pelo editor (StarterKit + extensões
 * instaladas em tiptap-editor.tsx) — um nó desconhecido é ignorado, nunca
 * quebra a geração inteira.
 */

const styles = StyleSheet.create({
  paragraph: { marginBottom: 8, fontSize: 11, lineHeight: 1.5 },
  h1: { fontSize: 20, fontWeight: 700, marginBottom: 10, marginTop: 4 },
  h2: { fontSize: 16, fontWeight: 700, marginBottom: 8, marginTop: 4 },
  h3: { fontSize: 13, fontWeight: 700, marginBottom: 6, marginTop: 4 },
  listItem: { flexDirection: "row", marginBottom: 4, fontSize: 11 },
  bullet: { width: 14 },
  blockquote: {
    borderLeft: "3pt solid #cbd5e1",
    paddingLeft: 10,
    marginBottom: 8,
    color: "#475569",
  },
  codeBlock: {
    backgroundColor: "#f1f5f9",
    padding: 8,
    marginBottom: 8,
    fontFamily: "Courier",
    fontSize: 9,
  },
  hr: { borderBottom: "1pt solid #e2e8f0", marginVertical: 10 },
  /**
   * Caixa de texto. Na tela ela flutua ao lado de uma figura; no PDF vira um
   * bloco na ordem em que está no documento — a paginação do react-pdf é um
   * fluxo, e uma caixa posicionada por coordenada atropelaria o texto na
   * primeira quebra de página. O que se preserva é a moldura, que é o que
   * marca aquele trecho como um aparte.
   */
  textBox: {
    border: "0.5pt solid #cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  table: { display: "flex", width: "100%", marginBottom: 8 },
  tableRow: { flexDirection: "row" },
  tableCell: {
    flex: 1,
    border: "0.5pt solid #cbd5e1",
    padding: 4,
    fontSize: 9,
  },
  tableHeaderCell: {
    flex: 1,
    border: "0.5pt solid #cbd5e1",
    padding: 4,
    fontSize: 9,
    fontWeight: 700,
    backgroundColor: "#f8fafc",
  },
});

function renderMarks(text: string, marks: JSONContent["marks"] = []) {
  const style: MutableStyle = {};
  let href: string | undefined;

  for (const mark of marks ?? []) {
    if (mark.type === "bold") style["fontWeight"] = 700;
    if (mark.type === "italic") style["fontStyle"] = "italic";
    if (mark.type === "underline") style["textDecoration"] = "underline";
    if (mark.type === "strike") style["textDecoration"] = "line-through";
    if (mark.type === "highlight") style["backgroundColor"] = "#fef08a";
    if (mark.type === "code") {
      style["fontFamily"] = "Courier";
      style["backgroundColor"] = "#f1f5f9";
    }
    if (mark.type === "link") href = mark.attrs?.["href"];
  }

  if (href) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver nota no topo do arquivo
      <Link src={href} style={{ ...style, color: "#2563eb" } as any}>
        {text}
      </Link>
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver nota no topo do arquivo
  return <Text style={style as any}>{text}</Text>;
}

function renderInline(nodes: JSONContent[] = []) {
  return nodes.map((node, i) => {
    if (node.type === "text") {
      return <Text key={i}>{renderMarks(node.text ?? "", node.marks)}</Text>;
    }
    if (node.type === "hardBreak") {
      return "\n";
    }
    return null;
  });
}

export function collectVocabulary(
  doc: JSONContent,
  out: Set<string> = new Set(),
): string[] {
  walk(doc, out);
  return Array.from(out);
}

function walk(node: JSONContent, out: Set<string>) {
  if (node.marks?.some((m) => m.type === "highlight") && node.text) {
    out.add(node.text);
  }
  node.content?.forEach((child) => walk(child, out));
}

export function renderNode(node: JSONContent, key: number | string): React.ReactNode {
  switch (node.type) {
    case "doc":
      return <View key={key}>{node.content?.map((n, i) => renderNode(n, i))}</View>;

    case "paragraph":
      return (
        <Text key={key} style={styles.paragraph}>
          {renderInline(node.content)}
        </Text>
      );

    case "heading": {
      const level = (node.attrs?.["level"] as number) ?? 1;
      const style = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
      return (
        <Text key={key} style={style}>
          {renderInline(node.content)}
        </Text>
      );
    }

    case "bulletList":
    case "orderedList":
      return (
        <View key={key}>
          {node.content?.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>
                {node.type === "bulletList" ? "•" : `${i + 1}.`}
              </Text>
              <View style={{ flex: 1 }}>
                {item.content?.map((n, j) => renderNode(n, j))}
              </View>
            </View>
          ))}
        </View>
      );

    case "taskList":
      return (
        <View key={key}>
          {node.content?.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>{item.attrs?.["checked"] ? "☑" : "☐"}</Text>
              <View style={{ flex: 1 }}>
                {item.content?.map((n, j) => renderNode(n, j))}
              </View>
            </View>
          ))}
        </View>
      );

    case "blockquote":
      return (
        <View key={key} style={styles.blockquote}>
          {node.content?.map((n, i) => renderNode(n, i))}
        </View>
      );

    case "textBox":
      return (
        <View key={key} style={styles.textBox}>
          {node.content?.map((n, i) => renderNode(n, i))}
        </View>
      );

    case "codeBlock":
      return (
        <Text key={key} style={styles.codeBlock}>
          {node.content?.map((n) => n.text).join("")}
        </Text>
      );

    case "horizontalRule":
      return <View key={key} style={styles.hr} />;

    case "table":
      return (
        <View key={key} style={styles.table}>
          {node.content?.map((row, i) => renderNode(row, i))}
        </View>
      );

    case "tableRow":
      return (
        <View key={key} style={styles.tableRow}>
          {node.content?.map((cell, i) => renderNode(cell, i))}
        </View>
      );

    case "tableCell":
    case "tableHeader":
      return (
        <View
          key={key}
          style={node.type === "tableHeader" ? styles.tableHeaderCell : styles.tableCell}
        >
          {node.content?.map((n, i) => renderNode(n, i))}
        </View>
      );

    case "image":
      return node.attrs?.["src"] ? (
        <View key={key} style={{ marginBottom: 8 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> do react-pdf, não <img> do DOM; não tem prop alt */}
          <Image src={node.attrs["src"] as string} style={{ maxWidth: "100%" }} />
        </View>
      ) : null;

    default:
      return null;
  }
}
