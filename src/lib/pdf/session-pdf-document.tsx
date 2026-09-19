import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { JSONContent } from "@tiptap/react";
import { renderNode } from "@/lib/pdf/tiptap-nodes";
import { PDF_FONT } from "@/lib/pdf/fonts";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 56, fontFamily: PDF_FONT, color: "#0b1a33" },
  header: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: "1pt solid #e3e9f3",
  },
  schoolName: { fontSize: 9, color: "#a8842a", marginBottom: 4, fontWeight: 700 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4, color: "#0a1f44" },
  meta: { fontSize: 10, color: "#64748b" },
  section: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fdf8ec",
    border: "0.75pt solid #e7cd8c",
  },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, color: "#0f2c5c" },
  body: { fontSize: 10.5, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
  },
});

interface SessionPdfDocumentProps {
  schoolName: string;
  groupName: string;
  sessionTitle: string;
  scheduledAt: string;
  content: JSONContent;
  homework: string | null;
}

/**
 * NUNCA recebe teacher_notes — quem monta isto já busca a sessão sem essa
 * coluna (RLS/coluna revogada, §5.3, §8.4).
 *
 * O corpo é a folha da aula desenhada como na tela (`renderNode`). O antigo
 * bloco "Vocabulário" saiu: ele repetia como lista as palavras realçadas, que
 * já aparecem realçadas no texto — coisa que a folha do planejador não tem.
 */
export function SessionPdfDocument({
  schoolName,
  groupName,
  sessionTitle,
  scheduledAt,
  content,
  homework,
}: SessionPdfDocumentProps) {
  const dateLabel = new Date(scheduledAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <Document title={sessionTitle} author={schoolName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.title}>{sessionTitle}</Text>
          <Text style={styles.meta}>
            {groupName ? `${groupName} · ` : ""}
            {dateLabel}
          </Text>
        </View>

        {renderNode(content, "root")}

        {homework && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Tarefa de casa</Text>
            <Text style={styles.body}>{homework}</Text>
          </View>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
