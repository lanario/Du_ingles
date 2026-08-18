import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { JSONContent } from "@tiptap/react";
import { renderNode, collectVocabulary } from "@/lib/pdf/tiptap-nodes";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  header: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: "1pt solid #e2e8f0",
  },
  schoolName: { fontSize: 10, color: "#64748b", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 10, color: "#64748b" },
  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
    color: "#334155",
  },
  vocabItem: { fontSize: 10, marginBottom: 2 },
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
 * NUNCA recebe teacher_notes — o Route Handler que monta isto já busca a
 * sessão sem essa coluna (RLS/coluna revogada, §5.3, §8.4).
 */
export function SessionPdfDocument({
  schoolName,
  groupName,
  sessionTitle,
  scheduledAt,
  content,
  homework,
}: SessionPdfDocumentProps) {
  const vocabulary = collectVocabulary(content);
  const dateLabel = new Date(scheduledAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.title}>{sessionTitle}</Text>
          <Text style={styles.meta}>
            {groupName} · {dateLabel}
          </Text>
        </View>

        <View>{renderNode(content, "root")}</View>

        {vocabulary.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vocabulário</Text>
            {vocabulary.map((word, i) => (
              <Text key={i} style={styles.vocabItem}>
                • {word}
              </Text>
            ))}
          </View>
        )}

        {homework && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tarefa de casa</Text>
            <Text style={styles.vocabItem}>{homework}</Text>
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
