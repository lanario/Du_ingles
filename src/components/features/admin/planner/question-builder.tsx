"use client";

/**
 * Construtor de questões da tarefa digital.
 *
 * O rascunho vive em estado React e sai num único campo JSON (`questions`) no
 * submit — lista de tamanho variável não cabe bem em campos soltos de FormData,
 * e o servidor revalida tudo de qualquer forma (`createExerciseAssignmentSchema`).
 *
 * Aqui enunciado e gabarito aparecem juntos, que é como o professor pensa. Quem
 * separa os dois — enunciado para o aluno ler, gabarito para coluna que o aluno
 * não alcança — é `splitQuestionDrafts`, no servidor.
 */

import { useEffect, useMemo, useState } from "react";
import {
  BLANK_TOKEN,
  QUESTION_TYPE_LABEL,
  QUESTION_TYPES,
  isObjective,
  optionLabel,
  type QuestionType,
} from "@/lib/assignments/exercises";
import { parseQuestions, type ParsedQuestion } from "@/lib/assignments/parse-questions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckIcon, CopyIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** Todos os campos coexistem no rascunho para o professor poder trocar o tipo
 * da questão sem perder o que já tinha digitado; a serialização descarta o que
 * não pertence ao tipo escolhido. */
interface Draft {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options: string[];
  correctIndex: number;
  correctBool: boolean;
  accepted: string[];
}

function newId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function newDraft(type: QuestionType): Draft {
  return {
    id: newId(),
    type,
    prompt: "",
    points: 1,
    options: ["", ""],
    correctIndex: 0,
    correctBool: true,
    accepted: [""],
  };
}

/** Questão lida do texto colado vira rascunho comum — daí em diante é tudo editável. */
function draftFromParsed(parsed: ParsedQuestion): Draft {
  return { id: newId(), ...parsed };
}

function serialize(drafts: Draft[]): string {
  if (drafts.length === 0) return "";
  return JSON.stringify(
    drafts.map((d) => {
      const base = {
        id: d.id,
        type: d.type,
        prompt: d.prompt.trim(),
        points: Number.isFinite(d.points) && d.points >= 0 ? d.points : 0,
      };
      if (d.type === "multiple_choice") {
        const options = d.options.map((o) => o.trim());
        const clampedCorrect = Math.max(0, Math.min(d.correctIndex, Math.max(0, options.length - 1)));
        return {
          ...base,
          options,
          correct: clampedCorrect,
        };
      }
      if (d.type === "true_false") return { ...base, correct: Boolean(d.correctBool) };
      if (d.type === "fill_blank") {
        const accepted = d.accepted.map((a) => a.trim());
        const valid = accepted.filter(Boolean);
        return {
          ...base,
          accepted: valid.length > 0 ? valid : [""],
        };
      }
      return base;
    }),
  );
}

const PLACEHOLDER: Record<QuestionType, string> = {
  multiple_choice: "Ex.: Which sentence is in the Present Perfect?",
  true_false: "Ex.: 'I have been to London' is Present Perfect.",
  fill_blank: `Ex.: She ${BLANK_TOKEN} (live) in Brazil since 2019.`,
  short_text: "Ex.: Write the past participle of 'go'.",
  long_text: "Ex.: Describe your last vacation using the Present Perfect.",
};

const PASTE_EXAMPLE = `1. Which sentence is in the Present Perfect?
a) I went to London.
b) I have been to London.
c) I go to London.
Resposta: B

2. She ___ (live) in Brazil since 2019. (2 pontos)
Resposta: has lived / 's lived

3. 'I have been to London' is Present Perfect.
Resposta: verdadeiro

4. Describe your last vacation using the Present Perfect.`;

export function QuestionBuilder({
  name = "questions",
  errors,
  onTotalPointsChange,
}: {
  name?: string;
  errors?: string[];
  onTotalPointsChange?: (total: number) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const parsed = useMemo(() => parseQuestions(pasteText), [pasteText]);

  const totalPoints = useMemo(
    () => drafts.reduce((sum, d) => sum + (Number.isFinite(d.points) ? d.points : 0), 0),
    [drafts],
  );
  const autoCount = useMemo(
    () => drafts.filter((d) => isObjective(d.type)).length,
    [drafts],
  );

  useEffect(() => {
    onTotalPointsChange?.(totalPoints);
  }, [totalPoints, onTotalPointsChange]);

  const errorsByQuestion = useMemo(() => {
    const map: Record<number, string[]> = {};
    if (!errors || errors.length === 0) return map;
    for (const err of errors) {
      const match = /^Questão (\d+):\s*(.+)$/i.exec(err);
      if (match) {
        const qIndex = parseInt(match[1]!, 10) - 1;
        if (!map[qIndex]) map[qIndex] = [];
        map[qIndex]!.push(match[2]!);
      }
    }
    return map;
  }, [errors]);

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function remove(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  function duplicate(index: number) {
    setDrafts((prev) => {
      const original = prev[index];
      if (!original) return prev;
      const copy: Draft = {
        ...original,
        id: newId(),
        options: [...original.options],
        accepted: [...original.accepted],
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }

  function importPasted() {
    if (parsed.length === 0) return;
    setDrafts((prev) => [...prev, ...parsed.map(draftFromParsed)]);
    setPasteText("");
    setPasting(false);
  }

  function move(index: number, delta: number) {
    setDrafts((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={serialize(drafts)} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label className="text-admin-foreground">Exercício digital</Label>
        {drafts.length > 0 && (
          <p className="text-xs text-admin-foreground/55">
            {drafts.length} quest{drafts.length === 1 ? "ão" : "ões"} · {totalPoints}{" "}
            ponto
            {totalPoints === 1 ? "" : "s"} ·{" "}
            {autoCount === 0 ? "correção manual" : `${autoCount} com correção automática`}
          </p>
        )}
      </div>

      {drafts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-admin-border bg-admin-background px-4 py-5 text-sm text-admin-foreground/55">
          Sem questões, a tarefa chega ao aluno como instruções e um campo de resposta
          livre. Adicione questões uma a uma — ou cole a lista pronta e deixe o app
          separar enunciado, alternativas e gabarito.
        </p>
      ) : (
        <ol className="space-y-3">
          {drafts.map((draft, index) => (
            <QuestionCard
              key={draft.id}
              draft={draft}
              index={index}
              total={drafts.length}
              cardErrors={errorsByQuestion[index]}
              onChange={(patch) => update(draft.id, patch)}
              onRemove={() => remove(draft.id)}
              onDuplicate={() => duplicate(index)}
              onMove={(delta) => move(index, delta)}
            />
          ))}
        </ol>
      )}

      {pasting && (
        <div className="rounded-xl border border-gold-300 bg-gold-50/60 p-3.5">
          <p className="text-sm font-medium text-admin-foreground">
            Cole as questões prontas
          </p>
          <p className="mt-1 text-xs text-admin-foreground/60">
            Numere as questões (1., 2., …), escreva as alternativas como{" "}
            <code className="font-mono text-gold-700">a)</code>,{" "}
            <code className="font-mono text-gold-700">b)</code> e marque o gabarito com
            uma linha <code className="font-mono text-gold-700">Resposta: B</code> — ou um{" "}
            <code className="font-mono text-gold-700">*</code> na alternativa certa.
            Lacunas com <code className="font-mono text-gold-700">{BLANK_TOKEN}</code>,
            pontos entre parênteses.
          </p>

          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={9}
            autoFocus
            placeholder={PASTE_EXAMPLE}
            aria-label="Texto das questões para colar"
            className="mt-2.5 w-full rounded-lg border border-admin-border bg-admin-surface px-3 py-2 font-mono text-xs leading-relaxed text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          />

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-admin-foreground/60">
              {pasteText.trim().length === 0
                ? "Cole o texto para ver o que foi reconhecido."
                : parsed.length === 0
                  ? "Nada reconhecido ainda — confira a numeração das questões."
                  : `${parsed.length} quest${parsed.length === 1 ? "ão reconhecida" : "ões reconhecidas"}: ` +
                    parsed
                      .map((q) => QUESTION_TYPE_LABEL[q.type].toLowerCase())
                      .join(", ")}
            </p>
            <div className="flex flex-none gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPasting(false);
                  setPasteText("");
                }}
                className="rounded-lg border border-admin-border bg-admin-surface px-2.5 py-1.5 text-xs font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={importPasted}
                disabled={parsed.length === 0}
                className="rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs font-semibold text-gold-400 transition-colors hover:bg-navy-800 disabled:pointer-events-none disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                {parsed.length > 1
                  ? `Adicionar ${parsed.length} questões`
                  : "Adicionar questão"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setPasting((open) => !open)}
          aria-expanded={pasting}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
            pasting
              ? "border-gold-400 bg-gold-100 text-admin-foreground"
              : "border-admin-border bg-admin-background text-admin-foreground/75 hover:border-gold-400 hover:bg-gold-50 hover:text-admin-foreground",
          )}
        >
          <CopyIcon className="h-3.5 w-3.5" />
          Colar questões
        </button>
        {QUESTION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setDrafts((prev) => [...prev, newDraft(type)])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-background px-2.5 py-1.5 text-xs font-medium text-admin-foreground/75 transition-colors hover:border-gold-400 hover:bg-gold-50 hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {QUESTION_TYPE_LABEL[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionCard({
  draft,
  index,
  total,
  cardErrors,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: {
  draft: Draft;
  index: number;
  total: number;
  cardErrors?: string[];
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
}) {
  const auto = isObjective(draft.type);
  const hasErrors = Boolean(cardErrors && cardErrors.length > 0);

  return (
    <li
      className={cn(
        "rounded-xl border p-3.5 transition-colors",
        hasErrors
          ? "border-destructive/60 bg-destructive/[0.02]"
          : "border-admin-border bg-admin-background",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid h-6 w-6 flex-none place-items-center rounded-md text-xs font-semibold",
            hasErrors
              ? "bg-destructive text-white"
              : "bg-navy-900 text-gold-400",
          )}
        >
          {index + 1}
        </span>

        <select
          value={draft.type}
          onChange={(e) => onChange({ type: e.target.value as QuestionType })}
          aria-label={`Tipo da questão ${index + 1}`}
          className="h-8 flex-1 rounded-lg border border-admin-border bg-admin-surface px-2 text-xs font-medium text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          {QUESTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {QUESTION_TYPE_LABEL[type]}
            </option>
          ))}
        </select>

        <div className="flex flex-none items-center gap-0.5">
          <IconButton
            label="Mover para cima"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </IconButton>
          <IconButton
            label="Mover para baixo"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </IconButton>
          <IconButton
            label={`Duplicar questão ${index + 1}`}
            disabled={false}
            onClick={onDuplicate}
          >
            <CopyIcon className="h-3.5 w-3.5" />
          </IconButton>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover questão ${index + 1}`}
            className="grid h-7 w-7 place-items-center rounded-md text-admin-foreground/45 transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <textarea
        value={draft.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        rows={2}
        maxLength={1000}
        placeholder={PLACEHOLDER[draft.type]}
        aria-label={`Enunciado da questão ${index + 1}`}
        className={cn(
          "mt-2.5 w-full rounded-lg border bg-admin-surface px-3 py-2 text-sm text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
          hasErrors && draft.prompt.trim() === ""
            ? "border-destructive/60 focus-visible:ring-destructive"
            : "border-admin-border",
        )}
      />

      {draft.type === "fill_blank" && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-admin-foreground/60">
            Escreva <code className="font-mono text-gold-700">{BLANK_TOKEN}</code> no lugar
            da lacuna.
          </p>
          <button
            type="button"
            onClick={() => {
              const token = BLANK_TOKEN;
              const current = draft.prompt;
              const sep = current && !current.endsWith(" ") ? " " : "";
              onChange({ prompt: `${current}${sep}${token} ` });
            }}
            className="inline-flex items-center gap-1 rounded-md border border-gold-300 bg-gold-50 px-2 py-0.5 font-medium text-navy-900 transition-colors hover:bg-gold-100"
          >
            <PlusIcon className="h-3 w-3" />
            Inserir lacuna ({BLANK_TOKEN})
          </button>
        </div>
      )}

      {draft.type === "fill_blank" &&
        draft.prompt.trim() !== "" &&
        !draft.prompt.includes(BLANK_TOKEN) && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Atenção: o enunciado não possui <code className="font-mono font-semibold">{BLANK_TOKEN}</code>. O campo de resposta será exibido abaixo do texto.
          </p>
        )}

      {draft.type === "multiple_choice" && (
        <ChoiceEditor draft={draft} index={index} onChange={onChange} />
      )}

      {draft.type === "true_false" && (
        <div className="mt-2.5 flex gap-1.5">
          {[true, false].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => onChange({ correctBool: value })}
              aria-pressed={draft.correctBool === value}
              className={cn(
                "h-8 flex-1 rounded-lg border text-xs font-semibold transition-colors",
                draft.correctBool === value
                  ? "border-success bg-success/10 text-success"
                  : "border-admin-border bg-admin-surface text-admin-foreground/60 hover:bg-admin-muted",
              )}
            >
              {value ? "Verdadeiro" : "Falso"} é a resposta
            </button>
          ))}
        </div>
      )}

      {draft.type === "fill_blank" && (
        <AcceptedEditor draft={draft} index={index} onChange={onChange} />
      )}

      {cardErrors && cardErrors.length > 0 && (
        <div
          role="alert"
          className="mt-2.5 space-y-0.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          {cardErrors.map((msg, i) => (
            <p key={i}>• {msg}</p>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-admin-border pt-2.5">
        <span
          className={cn(
            "text-xs font-medium",
            auto ? "text-success" : "text-admin-foreground/50",
          )}
        >
          {auto ? "Correção automática" : "Você corrige na mão"}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-admin-foreground/60">
          Vale
          <Input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={Number.isFinite(draft.points) ? draft.points : ""}
            placeholder="1"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onChange({ points: 0 });
                return;
              }
              const val = Number(raw);
              if (!Number.isFinite(val)) return;
              onChange({ points: Math.max(0, Math.min(100, val)) });
            }}
            aria-label={`Pontos da questão ${index + 1}`}
            className="h-8 w-16 border-admin-border bg-admin-surface px-2 text-xs focus-visible:ring-gold-500"
          />
          pt
        </label>
      </div>
    </li>
  );
}

function ChoiceEditor({
  draft,
  index,
  onChange,
}: {
  draft: Draft;
  index: number;
  onChange: (patch: Partial<Draft>) => void;
}) {
  return (
    <div className="mt-2.5 space-y-1.5">
      {draft.options.map((option, optionIndex) => {
        const correct = draft.correctIndex === optionIndex;
        return (
          <div key={optionIndex} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ correctIndex: optionIndex })}
              aria-label={`Marcar alternativa ${optionLabel(optionIndex)} como correta`}
              aria-pressed={correct}
              className={cn(
                "grid h-8 w-8 flex-none place-items-center rounded-lg border text-xs font-bold transition-colors",
                correct
                  ? "border-success bg-success text-white"
                  : "border-admin-border bg-admin-surface text-admin-foreground/50 hover:border-success/50",
              )}
            >
              {correct ? <CheckIcon className="h-3.5 w-3.5" /> : optionLabel(optionIndex)}
            </button>
            <Input
              value={option}
              onChange={(e) => {
                const options = [...draft.options];
                options[optionIndex] = e.target.value;
                onChange({ options });
              }}
              placeholder={`Alternativa ${optionLabel(optionIndex)}`}
              aria-label={`Alternativa ${optionLabel(optionIndex)} da questão ${index + 1}`}
              className="h-8 border-admin-border bg-admin-surface text-sm focus-visible:ring-gold-500"
            />
            {draft.options.length > 2 && (
              <button
                type="button"
                onClick={() => {
                  const options = draft.options.filter((_, i) => i !== optionIndex);
                  // A alternativa correta some junto: reancoramos o índice para
                  // não sobrar apontando para uma posição que mudou de dono.
                  const correctIndex =
                    draft.correctIndex === optionIndex
                      ? 0
                      : draft.correctIndex > optionIndex
                        ? draft.correctIndex - 1
                        : draft.correctIndex;
                  onChange({ options, correctIndex });
                }}
                aria-label={`Remover alternativa ${optionLabel(optionIndex)}`}
                className="grid h-8 w-7 flex-none place-items-center rounded-md text-admin-foreground/40 transition-colors hover:text-destructive"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {draft.options.length < 6 && (
        <button
          type="button"
          onClick={() => onChange({ options: [...draft.options, ""] })}
          className="ml-9 text-xs font-medium text-navy-700 underline underline-offset-2"
        >
          adicionar alternativa
        </button>
      )}
    </div>
  );
}

function AcceptedEditor({
  draft,
  index,
  onChange,
}: {
  draft: Draft;
  index: number;
  onChange: (patch: Partial<Draft>) => void;
}) {
  return (
    <div className="mt-2.5 space-y-1.5">
      <p className="text-xs font-medium text-admin-foreground/60">
        Respostas aceitas
        <span className="ml-1 font-normal text-admin-foreground/45">
          — acento e maiúscula não contam
        </span>
      </p>
      {draft.accepted.map((value, valueIndex) => (
        <div key={valueIndex} className="flex items-center gap-1.5">
          <Input
            value={value}
            onChange={(e) => {
              const accepted = [...draft.accepted];
              accepted[valueIndex] = e.target.value;
              onChange({ accepted });
            }}
            placeholder={valueIndex === 0 ? "has lived" : "outra forma aceita"}
            aria-label={`Resposta aceita ${valueIndex + 1} da questão ${index + 1}`}
            className="h-8 border-admin-border bg-admin-surface text-sm focus-visible:ring-gold-500"
          />
          {draft.accepted.length > 1 && (
            <button
              type="button"
              onClick={() =>
                onChange({ accepted: draft.accepted.filter((_, i) => i !== valueIndex) })
              }
              aria-label={`Remover resposta aceita ${valueIndex + 1}`}
              className="grid h-8 w-7 flex-none place-items-center rounded-md text-admin-foreground/40 transition-colors hover:text-destructive"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      {draft.accepted.length < 8 && (
        <button
          type="button"
          onClick={() => onChange({ accepted: [...draft.accepted, ""] })}
          className="text-xs font-medium text-navy-700 underline underline-offset-2"
        >
          aceitar outra escrita
        </button>
      )}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-md text-sm text-admin-foreground/45 transition-colors hover:bg-admin-muted hover:text-admin-foreground disabled:pointer-events-none disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
    >
      {children}
    </button>
  );
}
