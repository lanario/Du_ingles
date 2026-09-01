"use client";

import { useCallback, useRef, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { BOX_TONES, type LessonAlign, type LessonBoxTone } from "./extensions";
import { clamp, freeAnchorStyle, freeTransform, useFreeMove } from "./free-placement";

const MIN_WIDTH = 120;

const ALIGN_OPTIONS: { value: LessonAlign; label: string; glyph: string }[] = [
  { value: "left", label: "Ancorar à esquerda", glyph: "⬒" },
  { value: "center", label: "Ancorar no meio", glyph: "⬓" },
  { value: "right", label: "Ancorar à direita", glyph: "⬔" },
];

const TONE_CLASS: Record<LessonBoxTone, string> = {
  card: "border border-admin-border bg-white shadow-[var(--shadow-card)]",
  note: "border border-gold-300 bg-gold-50",
  plain: "border border-transparent bg-transparent",
};

/** Amostra da moldura na barrinha — o mesmo desenho, em miniatura. */
const TONE_SWATCH: Record<LessonBoxTone, string> = {
  card: "border-admin-border bg-white",
  note: "border-gold-300 bg-gold-50",
  plain: "border-dashed border-admin-foreground/40 bg-transparent",
};

/**
 * Caixa de texto da folha. Ela flutua sobre o papel (nunca reserva linha no
 * parágrafo, como a imagem solta), então dá para escrever ao lado de uma
 * figura, legendar um recorte ou montar duas colunas sem recorrer a tabela.
 *
 * Por dentro é um documento comum — o `NodeViewContent` é editado pelo
 * ProseMirror como qualquer bloco da folha. Por isso o corpo da caixa NÃO
 * inicia arrasto: ali o gesto é selecionar texto. Quem move é o punho ✥ da
 * barrinha, e quem redimensiona é o punho do canto.
 */
export function LessonTextBoxView(props: ReactNodeViewProps) {
  const { node, updateAttributes, deleteNode, editor } = props;
  const attrs = node.attrs as {
    width: number | null;
    align: LessonAlign;
    tone: LessonBoxTone;
    offsetX: number | null;
    offsetY: number | null;
    free: boolean;
  };

  const boxRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(attrs.width);

  const free = attrs.free !== false;
  const editable = editor.isEditable;

  const commitMove = useCallback(
    (offset: { x: number; y: number }) => {
      updateAttributes({ offsetX: offset.x, offsetY: offset.y, free: true });
    },
    [updateAttributes],
  );

  const {
    moving,
    offset: liveOffset,
    setOffset,
    startMove,
  } = useFreeMove({
    targetRef: boxRef,
    align: attrs.align,
    free,
    offsetX: attrs.offsetX ?? 0,
    offsetY: attrs.offsetY ?? 0,
    editable,
    onCommit: commitMove,
  });

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      if (!editable) return;
      event.preventDefault();
      event.stopPropagation();

      const box = boxRef.current;
      if (!box) return;

      const handle = event.currentTarget;
      const pointerId = event.pointerId;
      try {
        handle.setPointerCapture(pointerId);
      } catch {
        /* segue sem captura */
      }

      const startX = event.clientX;
      const startWidth = box.getBoundingClientRect().width;
      const maxWidth = box.parentElement?.getBoundingClientRect().width ?? 900;
      // Ancorada à direita, a caixa cresce para a esquerda: o punho fica do
      // lado de dentro e o gesto tem que acompanhar o que se vê.
      const growsLeft = attrs.align === "right";

      setResizing(true);
      let next = Math.round(startWidth);
      let frame = 0;

      const onMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const delta = (moveEvent.clientX - startX) * (growsLeft ? -1 : 1);
        next = Math.round(clamp(startWidth + delta, MIN_WIDTH, maxWidth));
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          box.style.width = `${next}px`;
          setLiveWidth(next);
        });
      };

      const finish = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", finish);
        handle.removeEventListener("pointercancel", finish);
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        if (frame) window.cancelAnimationFrame(frame);

        setResizing(false);
        setLiveWidth(next);
        updateAttributes({ width: next });
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", finish);
      handle.addEventListener("pointercancel", finish);
    },
    [attrs.align, editable, updateAttributes],
  );

  const displaced = liveOffset.x !== 0 || liveOffset.y !== 0;
  /**
   * O cromo (barrinha e punho) só existe no DOM enquanto o ponteiro está em
   * cima ou o cursor está dentro. Escondê-lo por opacidade não bastaria: uma
   * barra mais larga que a caixa continua contando para a rolagem da folha, e
   * a folha ganharia uma barra horizontal permanente por causa de um controle
   * que ninguém está vendo.
   */
  const chrome = editable && (hovered || focused || moving || resizing);

  return (
    <NodeViewWrapper
      as="div"
      data-align={attrs.align}
      data-free={free || undefined}
      className={cn(
        "lesson-text-box",
        free ? "lesson-free-anchor mt-4" : "my-4 flex w-full",
        !free && attrs.align === "center" && "justify-center",
        !free && attrs.align === "right" && "justify-end",
      )}
    >
      <div
        ref={boxRef}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...(free ? freeAnchorStyle(attrs.align) : null),
          width: liveWidth ?? 260,
          transform: freeTransform(attrs.align, liveOffset, free),
          willChange: moving ? "transform" : undefined,
        }}
        className={cn(
          "max-w-full rounded-xl transition-shadow",
          free ? "lesson-free-object" : "relative",
          TONE_CLASS[attrs.tone] ?? TONE_CLASS.card,
          moving && "z-20 shadow-[var(--shadow-card-hover)]",
        )}
      >
        <NodeViewContent
          className={cn(
            "lesson-text-box-body px-3.5 py-2.5",
            (moving || resizing) && "select-none",
          )}
        />

        {chrome && (
          <>
            {/* A barrinha só aparece com o ponteiro em cima ou com o cursor
                dentro da caixa: parada, ela tamparia o texto ao lado. */}
            <div
              contentEditable={false}
              data-box-control
              className={cn(
                "absolute -top-10 z-30 flex items-center gap-0.5 rounded-full border border-admin-border",
                "bg-white/95 px-1.5 py-1 shadow-[var(--shadow-card-hover)] backdrop-blur",
                // Ancorada à direita, a barra abre para dentro da coluna —
                // para fora ela empurraria a folha numa rolagem horizontal.
                attrs.align === "right" ? "right-0" : "left-0",
              )}
            >
              <button
                type="button"
                aria-label="Arrastar para mover a caixa"
                title="Arraste para mover a caixa"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  startMove(event);
                }}
                style={{ touchAction: "none" }}
                className="grid h-7 w-7 cursor-grab place-items-center rounded-full text-sm text-admin-foreground/60 transition-colors hover:bg-admin-muted active:cursor-grabbing"
              >
                <span aria-hidden>✥</span>
              </button>

              <span className="mx-1 h-4 w-px bg-admin-border" aria-hidden />

              {ALIGN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  title={option.label}
                  aria-pressed={attrs.align === option.value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => updateAttributes({ align: option.value })}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-sm transition-colors",
                    attrs.align === option.value
                      ? "bg-navy-900 text-white"
                      : "text-admin-foreground/60 hover:bg-admin-muted",
                  )}
                >
                  <span aria-hidden>{option.glyph}</span>
                </button>
              ))}

              <span className="mx-1 h-4 w-px bg-admin-border" aria-hidden />

              {/* Amostras, e não os nomes das molduras: a barra fica estreita
                  o bastante para caber na coluna ao lado da caixa. */}
              {BOX_TONES.map((tone) => (
                <button
                  key={tone.value}
                  type="button"
                  title={`Moldura: ${tone.label}`}
                  aria-label={`Moldura: ${tone.label}`}
                  aria-pressed={attrs.tone === tone.value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => updateAttributes({ tone: tone.value })}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full transition-colors",
                    attrs.tone === tone.value ? "bg-navy-900" : "hover:bg-admin-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("h-4 w-4 rounded-[5px] border", TONE_SWATCH[tone.value])}
                  />
                </button>
              ))}

              {displaced && (
                <button
                  type="button"
                  title="Devolver a caixa ao lugar de origem"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOffset({ x: 0, y: 0 });
                    updateAttributes({ offsetX: 0, offsetY: 0 });
                  }}
                  className="rounded-full px-2 py-1 text-[11px] font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted"
                >
                  Voltar ao lugar
                </button>
              )}

              <button
                type="button"
                aria-label="Remover caixa de texto"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => deleteNode()}
                className="grid h-7 w-7 place-items-center rounded-full text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <span aria-hidden>✕</span>
              </button>
            </div>

            <span
              role="presentation"
              contentEditable={false}
              data-box-control
              onPointerDown={startResize}
              style={{ touchAction: "none" }}
              className={cn(
                "absolute -bottom-1.5 z-20 h-3.5 w-3.5 rounded-full border-2 border-white bg-navy-900 shadow",
                attrs.align === "right"
                  ? "-left-1.5 cursor-nesw-resize"
                  : "-right-1.5 cursor-nwse-resize",
              )}
            />
          </>
        )}

        {(moving || resizing) && (
          <span className="absolute -top-1 right-2 z-30 rounded-md bg-navy-900/85 px-2 py-0.5 text-[11px] font-medium tabular text-white">
            {resizing
              ? `${liveWidth ?? 260}px`
              : `${liveOffset.x >= 0 ? "+" : ""}${liveOffset.x} · ${liveOffset.y >= 0 ? "+" : ""}${liveOffset.y}`}
          </span>
        )}
      </div>
    </NodeViewWrapper>
  );
}
