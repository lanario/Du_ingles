import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  BLANK_TOKEN,
  QUESTION_TYPE_LABEL,
  optionLabel,
  type AnswerKey,
  type Question,
} from "@/lib/assignments/exercises";
import {
  BRAND,
  BrandFooter,
  BrandHeader,
  BrandSection,
  brandPageStyle,
} from "@/lib/pdf/brand";

/**
 * Folha de exercícios para imprimir: o aluno responde à caneta. Mesmo
 * conteúdo que o exercício digital (`instructions.questions`), desenhado
 * como prova — alternativas com bolinha, lacunas com traço, linhas para
 * as dissertativas.
 *
 * Com `answerKey`, vira a versão do professor: alternativa certa preenchida
 * e respostas aceitas escritas nas lacunas. Sem ele, nada do gabarito entra
 * no arquivo — quem monta isto só passa o gabarito para staff.
 */

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: BRAND.navy900,
    marginTop: 20,
  },
  meta: { fontSize: 9, color: BRAND.muted, marginTop: 4 },
  cards: { flexDirection: "row", marginTop: 16 },
  card: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: BRAND.cream,
    border: `0.75pt solid ${BRAND.line}`,
  },
  cardWide: { flex: 1 },
  cardScore: { width: 132, flexGrow: 0, flexShrink: 0 },
  cardGap: { width: 12 },
  cardLabel: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1.4,
    color: BRAND.gold700,
    marginBottom: 8,
  },
  fieldRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 6 },
  fieldName: {
    fontSize: 7.5,
    fontWeight: 700,
    color: BRAND.muted,
    width: 96,
    letterSpacing: 0.6,
  },
  fieldLine: {
    flex: 1,
    borderBottom: `0.75pt solid ${BRAND.gold300}`,
    minHeight: 13,
    fontSize: 9.5,
    color: BRAND.ink,
    paddingBottom: 1,
  },
  scoreBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 4,
  },
  scoreValue: { fontSize: 26, fontWeight: 700, color: BRAND.navy900 },
  scoreMax: {
    fontSize: 11,
    fontWeight: 700,
    color: BRAND.muted,
    marginLeft: 6,
    marginBottom: 5,
  },
  answerKeyBanner: {
    marginTop: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: BRAND.navy900,
    color: BRAND.gold300,
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 0.6,
  },
  instructions: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: BRAND.gold50,
    borderLeft: `3pt solid ${BRAND.gold500}`,
    fontSize: 10,
    lineHeight: 1.5,
    color: BRAND.ink,
  },
  question: {
    flexDirection: "row",
    paddingVertical: 11,
    borderBottom: `0.75pt solid ${BRAND.navy50}`,
  },
  number: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND.navy900,
    color: BRAND.white,
    fontSize: 9.5,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 6,
    marginRight: 12,
  },
  body: { flex: 1 },
  qHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  qType: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1,
    color: BRAND.gold700,
  },
  qPoints: {
    fontSize: 7.5,
    color: BRAND.navy700,
    backgroundColor: BRAND.navy50,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  prompt: { fontSize: 10.5, lineHeight: 1.5, color: BRAND.ink },
  options: { marginTop: 6 },
  option: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  bubble: {
    width: 14,
    height: 14,
    borderRadius: 7,
    border: `0.9pt solid ${BRAND.navy700}`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  bubbleOn: { backgroundColor: BRAND.gold500, borderColor: BRAND.gold600 },
  bubbleText: { fontSize: 7, fontWeight: 700, color: BRAND.navy800 },
  optionText: { fontSize: 10, color: BRAND.ink },
  optionFill: { flex: 1 },
  optionTextOn: { fontWeight: 700, color: BRAND.gold700 },
  tfRow: { flexDirection: "row", marginTop: 8 },
  tfItem: { flexDirection: "row", alignItems: "center", marginRight: 26 },
  box: {
    width: 13,
    height: 13,
    borderRadius: 3,
    border: `0.9pt solid ${BRAND.navy700}`,
    marginRight: 7,
  },
  writeLine: {
    height: 22,
    borderBottom: `0.75pt solid ${BRAND.navy100}`,
  },
  keyAnswer: {
    marginTop: 6,
    fontSize: 9.5,
    color: BRAND.gold700,
    fontWeight: 700,
  },
  keyNote: { marginTop: 6, fontSize: 9, color: BRAND.muted, fontStyle: "italic" },
  blank: { color: BRAND.gold700, fontWeight: 700, textDecoration: "underline" },
  signatures: { flexDirection: "row", marginTop: 40 },
  signature: {
    flex: 1,
    borderTop: `0.75pt solid ${BRAND.navy900}`,
    paddingTop: 6,
    fontSize: 7.5,
    letterSpacing: 1.4,
    color: BRAND.muted,
    textAlign: "center",
  },
});

/** Linhas de resposta por tipo — a dissertativa pede espaço de verdade. */
const WRITE_LINES: Partial<Record<Question["type"], number>> = {
  short_text: 2,
  long_text: 7,
};

const BLANK_LINE = "________________";

function formatPoints(points: number): string {
  const n = Number.isInteger(points) ? String(points) : points.toFixed(1);
  return `${n} pt${points === 1 ? "" : "s"}`;
}

function Prompt({ question, answerKey }: { question: Question; answerKey?: AnswerKey }) {
  if (question.type !== "fill_blank" || !question.prompt.includes(BLANK_TOKEN)) {
    return <Text style={styles.prompt}>{question.prompt}</Text>;
  }

  const key = answerKey?.[question.id];
  const answer = key?.type === "fill_blank" ? key.accepted[0] : undefined;
  const parts = question.prompt.split(BLANK_TOKEN);

  return (
    <Text style={styles.prompt}>
      {parts.map((part, i) => (
        <Text key={i}>
          {part}
          {i < parts.length - 1 &&
            (answer ? <Text style={styles.blank}>{`  ${answer}  `}</Text> : BLANK_LINE)}
        </Text>
      ))}
    </Text>
  );
}

function Answer({ question, answerKey }: { question: Question; answerKey?: AnswerKey }) {
  const key = answerKey?.[question.id];

  if (question.type === "multiple_choice") {
    const correct = key?.type === "multiple_choice" ? key.correct : -1;
    return (
      <View style={styles.options}>
        {(question.options ?? []).map((option, i) => {
          const on = i === correct;
          return (
            <View key={i} style={styles.option} wrap={false}>
              <View style={on ? [styles.bubble, styles.bubbleOn] : styles.bubble}>
                <Text style={styles.bubbleText}>{optionLabel(i)}</Text>
              </View>
              <Text
                style={[
                  styles.optionText,
                  styles.optionFill,
                  ...(on ? [styles.optionTextOn] : []),
                ]}
              >
                {option}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  if (question.type === "true_false") {
    const correct = key?.type === "true_false" ? key.correct : null;
    return (
      <View style={styles.tfRow}>
        {[
          { value: true, label: "Verdadeiro" },
          { value: false, label: "Falso" },
        ].map(({ value, label }) => {
          const on = correct === value;
          return (
            <View key={label} style={styles.tfItem}>
              <View style={on ? [styles.box, styles.bubbleOn] : styles.box} />
              <Text
                style={on ? [styles.optionText, styles.optionTextOn] : styles.optionText}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  if (question.type === "fill_blank") {
    // Lacuna dentro do enunciado já foi desenhada em `Prompt`; sem o marcador,
    // a resposta vai numa linha própria.
    if (question.prompt.includes(BLANK_TOKEN)) {
      return key?.type === "fill_blank" && key.accepted.length > 1 ? (
        <Text style={styles.keyAnswer}>
          Também aceito: {key.accepted.slice(1).join(" · ")}
        </Text>
      ) : null;
    }
    if (key?.type === "fill_blank") {
      return <Text style={styles.keyAnswer}>Resposta: {key.accepted.join(" · ")}</Text>;
    }
    return <View style={styles.writeLine} />;
  }

  // Dissertativa: não há gabarito, mesmo na versão do professor.
  if (answerKey) {
    return <Text style={styles.keyNote}>Resposta pessoal — correção do professor.</Text>;
  }
  const lines = WRITE_LINES[question.type] ?? 2;
  return (
    <View style={{ marginTop: 2 }}>
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={styles.writeLine} />
      ))}
    </View>
  );
}

export interface AssignmentPdfDocumentProps {
  schoolName: string;
  title: string;
  /** Vazio no ateliê (tarefa ainda sem turma): vira linha para preencher. */
  groupName: string | null;
  /** Professor da turma (ou dono da tarefa padrão), abaixo do nome da escola. */
  teacherName: string | null;
  /** Só quando quem baixa é o próprio aluno — staff recebe a linha em branco. */
  studentName: string | null;
  /** Data de entrega (prazo). Sem prazo, a data em que o PDF foi gerado. */
  dateLabel: string;
  instructions: string | null;
  questions: Question[];
  /** Nota do aluno — só chega quando a tarefa dele já foi corrigida. */
  grade?: { score: number; maxScore: number | null } | null;
  answerKey?: AnswerKey;
}

export function AssignmentPdfDocument({
  schoolName,
  title,
  groupName,
  teacherName,
  studentName,
  dateLabel,
  instructions,
  questions,
  grade,
  answerKey,
}: AssignmentPdfDocumentProps) {
  const isKey = Boolean(answerKey);
  const total = questions.length;
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const meta = [
    total > 0 ? `${total} ${total === 1 ? "questão" : "questões"}` : "Resposta livre",
    totalPoints > 0 ? `${formatPoints(totalPoints)} no total` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Document title={isKey ? `${title} — gabarito` : title} author={schoolName}>
      <Page size="A4" style={brandPageStyle}>
        <BrandHeader
          schoolName={schoolName}
          tagline={teacherName ? `Professor(a): ${teacherName}` : "ESCOLA DE INGLÊS"}
          kicker={isKey ? "GABARITO" : "LISTA DE EXERCÍCIOS"}
          value={total > 0 ? String(total).padStart(2, "0") : "—"}
          caption={total === 1 ? "questão" : "questões"}
          subBar={[
            groupName ? `Turma: ${groupName}` : null,
            `Entrega: ${dateLabel}`,
            `Gerado em ${today}`,
          ]
            .filter(Boolean)
            .join("   ·   ")}
        />

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{meta}</Text>

        {isKey ? (
          <Text style={styles.answerKeyBanner}>
            VERSÃO DO PROFESSOR — respostas destacadas em dourado. Não distribuir aos
            alunos.
          </Text>
        ) : (
          <View style={styles.cards}>
            <View style={[styles.card, styles.cardWide]}>
              <Text style={styles.cardLabel}>IDENTIFICAÇÃO</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldName}>ALUNO</Text>
                <Text style={styles.fieldLine}>{studentName ?? " "}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldName}>TURMA</Text>
                <Text style={styles.fieldLine}>{groupName ?? " "}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldName}>DATA DA ENTREGA</Text>
                <Text style={styles.fieldLine}>{dateLabel}</Text>
              </View>
            </View>
            {grade && (
              <>
                <View style={styles.cardGap} />
                <View style={[styles.card, styles.cardScore]}>
                  <Text style={styles.cardLabel}>NOTA</Text>
                  <View style={styles.scoreBox}>
                    <Text style={styles.scoreValue}>
                      {grade.score.toLocaleString("pt-BR")}
                    </Text>
                    {grade.maxScore != null && (
                      <Text style={styles.scoreMax}>
                        / {grade.maxScore.toLocaleString("pt-BR")}
                      </Text>
                    )}
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {instructions && (
          <BrandSection label="Instruções">
            <Text style={styles.instructions}>{instructions}</Text>
          </BrandSection>
        )}

        {total > 0 ? (
          <BrandSection label="Questões">
            {questions.map((question, index) => (
              <View key={question.id} style={styles.question} wrap={false}>
                <Text style={styles.number}>{index + 1}</Text>
                <View style={styles.body}>
                  <View style={styles.qHead}>
                    <Text style={styles.qType}>
                      {QUESTION_TYPE_LABEL[question.type].toUpperCase()}
                    </Text>
                    <Text style={styles.qPoints}>{formatPoints(question.points)}</Text>
                  </View>
                  <Prompt question={question} answerKey={answerKey} />
                  <Answer question={question} answerKey={answerKey} />
                </View>
              </View>
            ))}
          </BrandSection>
        ) : (
          <BrandSection label="Resposta">
            {Array.from({ length: 14 }, (_, i) => (
              <View key={i} style={styles.writeLine} />
            ))}
          </BrandSection>
        )}

        {!isKey && (
          <View style={styles.signatures} wrap={false}>
            <Text style={styles.signature}>ALUNO</Text>
            <View style={{ width: 40 }} />
            <Text style={styles.signature}>PROFESSOR</Text>
          </View>
        )}

        <BrandFooter label={isKey ? `Gabarito · ${title}` : `Tarefa · ${title}`} />
      </Page>
    </Document>
  );
}
