import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { JSONContent } from "@tiptap/react";
import { renderNode } from "@/lib/pdf/tiptap-nodes";
import {
  BRAND,
  BrandFooter,
  BrandHeader,
  BrandSection,
  brandPageStyle,
} from "@/lib/pdf/brand";

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: BRAND.navy900,
    marginTop: 20,
  },
  summary: { fontSize: 10, color: BRAND.muted, marginTop: 4, lineHeight: 1.45 },
  titleGap: { height: 16 },
  box: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: BRAND.gold50,
    borderLeft: `3pt solid ${BRAND.gold500}`,
    fontSize: 10.5,
    lineHeight: 1.5,
  },
});

/**
 * Moldura comum às duas folhas de aula: a aula dada (`class_sessions`) e o
 * plano do ateliê (`lesson_plans`). O corpo é a folha desenhada como na tela
 * (`renderNode`), dentro da identidade da marca (`brand.tsx`) — a mesma do
 * PDF de tarefa. A coluna útil continua com 40pt de margem lateral (`COLUMN`
 * em `tiptap-nodes.tsx`).
 */
function LessonPdfFrame({
  schoolName,
  tagline,
  title,
  summary,
  kicker,
  value,
  caption,
  subBar,
  footerLabel,
  content,
  extra,
}: {
  schoolName: string;
  tagline: string;
  title: string;
  summary?: string | null;
  kicker: string;
  value: string;
  caption?: string;
  subBar: string;
  footerLabel: string;
  content: JSONContent;
  extra?: { label: string; text: string } | null;
}) {
  return (
    <Document title={title} author={schoolName}>
      <Page size="A4" style={brandPageStyle}>
        <BrandHeader
          schoolName={schoolName}
          tagline={tagline}
          kicker={kicker}
          value={value}
          caption={caption}
          subBar={subBar}
        />

        <Text style={styles.title}>{title}</Text>
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        <View style={styles.titleGap} />

        {renderNode(content, "root")}

        {extra && (
          <View wrap={false}>
            <BrandSection label={extra.label}>
              <Text style={styles.box}>{extra.text}</Text>
            </BrandSection>
          </View>
        )}

        <BrandFooter label={footerLabel} />
      </Page>
    </Document>
  );
}

const TZ = "America/Sao_Paulo";

interface SessionPdfDocumentProps {
  schoolName: string;
  groupName: string;
  /** Professor que deu a aula, abaixo do nome da escola no cabeçalho. */
  teacherName: string | null;
  sessionTitle: string;
  scheduledAt: string;
  content: JSONContent;
  homework: string | null;
}

/**
 * NUNCA recebe teacher_notes — quem monta isto já busca a sessão sem essa
 * coluna (RLS/coluna revogada, §5.3, §8.4).
 */
export function SessionPdfDocument({
  schoolName,
  groupName,
  teacherName,
  sessionTitle,
  scheduledAt,
  content,
  homework,
}: SessionPdfDocumentProps) {
  const date = new Date(scheduledAt);
  const dateLabel = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });

  return (
    <LessonPdfFrame
      schoolName={schoolName}
      tagline={teacherName ? `Professor(a): ${teacherName}` : "ESCOLA DE INGLÊS"}
      title={sessionTitle}
      kicker="MATERIAL DA AULA"
      value={date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: TZ,
      })}
      caption={date.toLocaleDateString("pt-BR", { year: "numeric", timeZone: TZ })}
      subBar={[groupName ? `Turma: ${groupName}` : null, dateLabel]
        .filter(Boolean)
        .join("   ·   ")}
      footerLabel={`Aula · ${sessionTitle}`}
      content={content}
      extra={homework ? { label: "Tarefa de casa", text: homework } : null}
    />
  );
}

interface LessonPlanPdfDocumentProps {
  schoolName: string;
  title: string;
  summary: string | null;
  level: string;
  durationMinutes: number;
  authorName: string;
  content: JSONContent;
}

/** Plano de aula do ateliê — ainda sem turma nem data, então o selo é o nível. */
export function LessonPlanPdfDocument({
  schoolName,
  title,
  summary,
  level,
  durationMinutes,
  authorName,
  content,
}: LessonPlanPdfDocumentProps) {
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: TZ });

  return (
    <LessonPdfFrame
      schoolName={schoolName}
      tagline={`Autor(a): ${authorName}`}
      title={title}
      summary={summary}
      kicker="PLANO DE AULA"
      value={level}
      caption={`${durationMinutes} min`}
      subBar={[
        `Autor(a): ${authorName}`,
        `${durationMinutes} min`,
        `Gerado em ${today}`,
      ].join("   ·   ")}
      footerLabel={`Plano de aula · ${title}`}
      content={content}
    />
  );
}
