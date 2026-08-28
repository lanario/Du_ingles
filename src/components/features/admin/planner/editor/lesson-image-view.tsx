"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LessonAlign } from "./extensions";

const MIN_WIDTH = 96;
/** Abaixo disto o gesto ainda é um clique — arrastar só começa depois. */
const MOVE_THRESHOLD = 4;
/** Folga que a imagem pode sair da coluna de texto, para cada lado. */
const FREE_PLAY_X = 160;
const LIMIT_Y = 1400;

const HANDLES = [
  { corner: "nw", className: "-left-1.5 -top-1.5 cursor-nwse-resize" },
  { corner: "ne", className: "-right-1.5 -top-1.5 cursor-nesw-resize" },
  { corner: "sw", className: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
  { corner: "se", className: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
] as const;

const ALIGN_OPTIONS: { value: LessonAlign; label: string; glyph: string }[] = [
  { value: "left", label: "Alinhar à esquerda", glyph: "⬒" },
  { value: "center", label: "Centralizar", glyph: "⬓" },
  { value: "right", label: "Alinhar à direita", glyph: "⬔" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Imagem do canvas. Redimensionar e mover acontecem no DOM durante o arrasto
 * (uma transação do ProseMirror por pixel derrubaria o histórico de desfazer)
 * e só viram atributo do documento quando o ponteiro solta.
 *
 * Mover é um `translate` a partir da âncora do alinhamento: a figura anda pela
 * folha sem empurrar o texto — é uma imagem colada em cima do papel, não um
 * bloco disputando espaço com o parágrafo.
 */
export function LessonImageView(props: ReactNodeViewProps) {
  const { node, updateAttributes, deleteNode, selected, editor, getPos } = props;
  const attrs = node.attrs as {
    src: string;
    alt: string | null;
    title: string | null;
    width: number | null;
    align: LessonAlign;
    offsetX: number | null;
    offsetY: number | null;
    uploadId: string | null;
  };

  const figureRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [dragging, setDragging] = useState(false);
  const [moving, setMoving] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(attrs.width);
  const [liveOffset, setLiveOffset] = useState({
    x: attrs.offsetX ?? 0,
    y: attrs.offsetY ?? 0,
  });

  // Só sincroniza quando o documento traz uma largura de verdade: um `null`
  // vindo de um redesenho do nó não pode apagar o tamanho recém-arrastado.
  useEffect(() => {
    if (typeof attrs.width === "number") setLiveWidth(attrs.width);
  }, [attrs.width]);

  // O deslocamento tem `0` como padrão no schema, então o valor que vem do
  // documento é sempre um número — dá para espelhar direto.
  useEffect(() => {
    setLiveOffset({ x: attrs.offsetX ?? 0, y: attrs.offsetY ?? 0 });
  }, [attrs.offsetX, attrs.offsetY]);

  const uploading = Boolean(attrs.uploadId);
  const editable = editor.isEditable;

  /** Seleciona o nó já no clique, para os punhos e a barrinha aparecerem. */
  const selectNode = useCallback(() => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    try {
      editor.commands.setNodeSelection(pos);
    } catch {
      /* posição obsoleta entre transações: o ProseMirror seleciona sozinho */
    }
  }, [editor, getPos]);

  /**
   * Redimensionar com o ponteiro CAPTURADO pelo punho. Sem a captura, o
   * arrasto que começa dentro do nó vira um drag-and-drop nativo do
   * ProseMirror: os eventos de ponteiro morrem no meio do caminho, o nó é
   * reinserido no documento e a imagem volta ao tamanho original ao soltar.
   */
  const startResize = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>, corner: string) => {
      if (!editable) return;
      event.preventDefault();
      event.stopPropagation();

      const image = imageRef.current;
      const figure = figureRef.current;
      if (!image || !figure) return;

      const handle = event.currentTarget;
      const pointerId = event.pointerId;
      // Navegadores recusam capturar um ponteiro que não está ativo — nesse
      // caso o arrasto ainda funciona pelos listeners abaixo.
      try {
        handle.setPointerCapture(pointerId);
      } catch {
        /* segue sem captura */
      }

      const startX = event.clientX;
      const startWidth = image.getBoundingClientRect().width;
      const maxWidth = figure.parentElement?.getBoundingClientRect().width ?? 900;
      const growsLeft = corner === "nw" || corner === "sw";

      setDragging(true);
      let next = Math.round(startWidth);
      let frame = 0;

      const onMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const delta = (moveEvent.clientX - startX) * (growsLeft ? -1 : 1);
        next = Math.round(clamp(startWidth + delta, MIN_WIDTH, maxWidth));
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          // Escreve no DOM durante o arrasto: uma transação do ProseMirror
          // por pixel encheria o histórico de desfazer.
          image.style.width = `${next}px`;
          setLiveWidth(next);
        });
      };

      const finish = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", finish);
        handle.removeEventListener("pointercancel", finish);
        if (handle.hasPointerCapture(pointerId)) {
          handle.releasePointerCapture(pointerId);
        }
        if (frame) window.cancelAnimationFrame(frame);

        setDragging(false);
        setLiveWidth(next);
        // A largura vira atributo do nó só aqui — é o que persiste no
        // documento. O estilo inline continua no lugar, então não há
        // piscada entre a transação e o novo render.
        updateAttributes({ width: next });
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", finish);
      handle.addEventListener("pointercancel", finish);
    },
    [editable, updateAttributes],
  );

  /**
   * Mover. Os listeners moram na janela, e não no elemento, porque o punho ✥
   * some assim que o arrasto começa (a barrinha se esconde para não tampar a
   * imagem); a captura fica na figura, que sobrevive ao gesto inteiro.
   */
  const startMove = useCallback(
    (origin: { clientX: number; clientY: number; pointerId: number }) => {
      if (!editable) return;

      const figure = figureRef.current;
      if (!figure) return;

      const baseX = attrs.offsetX ?? 0;
      const baseY = attrs.offsetY ?? 0;
      const wrapperWidth = figure.parentElement?.getBoundingClientRect().width ?? 900;
      const figureWidth = figure.getBoundingClientRect().width;
      // A imagem passeia pelo espaço que sobra da coluna, mais uma folga para
      // cada lado — o bastante para escapar do texto sem sumir atrás da borda
      // da folha, que corta o que passa dela.
      const limitX = Math.max((wrapperWidth - figureWidth) / 2, 0) + FREE_PLAY_X;

      let next = { x: baseX, y: baseY };
      let started = false;
      let frame = 0;

      const onMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== origin.pointerId) return;
        const dx = moveEvent.clientX - origin.clientX;
        const dy = moveEvent.clientY - origin.clientY;

        // O arrasto só nasce depois do limiar: sem isso, um clique com a mão
        // trêmula viraria um deslocamento de dois pixels no documento.
        if (!started) {
          if (Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
          started = true;
          setMoving(true);
          try {
            figure.setPointerCapture(origin.pointerId);
          } catch {
            /* segue sem captura */
          }
        }

        moveEvent.preventDefault();
        next = {
          x: Math.round(clamp(baseX + dx, -limitX, limitX)),
          y: Math.round(clamp(baseY + dy, -LIMIT_Y, LIMIT_Y)),
        };
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          figure.style.transform = `translate(${next.x}px, ${next.y}px)`;
          setLiveOffset(next);
        });
      };

      const finish = (endEvent: PointerEvent) => {
        if (endEvent.pointerId !== origin.pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        if (frame) window.cancelAnimationFrame(frame);
        if (figure.hasPointerCapture(origin.pointerId)) {
          figure.releasePointerCapture(origin.pointerId);
        }
        if (!started) return;

        setMoving(false);
        setLiveOffset(next);
        updateAttributes({ offsetX: next.x, offsetY: next.y });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [attrs.offsetX, attrs.offsetY, editable, updateAttributes],
  );

  /**
   * Arrastar pelo corpo da imagem só vale para o mouse. No toque, esse mesmo
   * gesto é rolar a folha — quem move no tablet usa o punho ✥ da barrinha, que
   * declara `touch-action: none` só para si.
   */
  function handleFigurePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!editable || event.button !== 0) return;
    if (event.pointerType !== "mouse") return;
    if ((event.target as HTMLElement).closest("[data-image-control]")) return;
    selectNode();
    startMove(event);
  }

  const active = selected && editable;
  const displaced = liveOffset.x !== 0 || liveOffset.y !== 0;

  return (
    <NodeViewWrapper
      as="div"
      data-align={attrs.align}
      className={cn(
        "lesson-image my-4 flex w-full",
        attrs.align === "left" && "justify-start",
        attrs.align === "right" && "justify-end",
        (!attrs.align || attrs.align === "center") && "justify-center",
      )}
    >
      <div
        ref={figureRef}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={handleFigurePointerDown}
        style={{
          transform: displaced
            ? `translate(${liveOffset.x}px, ${liveOffset.y}px)`
            : undefined,
          willChange: moving ? "transform" : undefined,
        }}
        className={cn(
          "relative inline-block max-w-full rounded-xl transition-shadow",
          // Imagem deslocada passa por cima do texto, não por baixo: ela foi
          // posta ali de propósito.
          displaced && "z-10",
          moving && "z-20 shadow-[var(--shadow-card-hover)]",
          editable && !dragging && (moving ? "cursor-grabbing" : "cursor-grab"),
          active && "ring-2 ring-gold-500 ring-offset-2 ring-offset-white",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={attrs.src}
          alt={attrs.alt ?? ""}
          title={attrs.title ?? undefined}
          draggable={false}
          style={liveWidth ? { width: liveWidth } : undefined}
          className={cn(
            "block h-auto max-w-full rounded-xl",
            uploading && "opacity-60",
            (dragging || moving) && "select-none",
          )}
        />

        {uploading && (
          <span className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-navy-900/85 px-3 py-1 text-xs font-medium text-white">
            enviando imagem…
          </span>
        )}

        <AnimatePresence>
          {active && !dragging && !moving && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              contentEditable={false}
              data-image-control
              className="absolute -top-11 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-admin-border bg-white/95 px-1.5 py-1 shadow-[var(--shadow-card-hover)] backdrop-blur"
            >
              <button
                type="button"
                aria-label="Arrastar para mover a imagem"
                title="Arraste para mover a imagem"
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
                  aria-pressed={attrs.align === option.value}
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

              <button
                type="button"
                onClick={() => updateAttributes({ width: null })}
                className="rounded-full px-2 py-1 text-[11px] font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted"
              >
                Tamanho original
              </button>

              {displaced && (
                <button
                  type="button"
                  title="Devolver a imagem ao lugar de origem"
                  onClick={() => updateAttributes({ offsetX: 0, offsetY: 0 })}
                  className="rounded-full px-2 py-1 text-[11px] font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted"
                >
                  Voltar ao lugar
                </button>
              )}

              <button
                type="button"
                aria-label="Remover imagem"
                onClick={() => deleteNode()}
                className="grid h-7 w-7 place-items-center rounded-full text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <span aria-hidden>✕</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {active &&
          !moving &&
          HANDLES.map((handle) => (
            <span
              key={handle.corner}
              role="presentation"
              draggable={false}
              data-image-control
              onDragStart={(event) => event.preventDefault()}
              onPointerDown={(event) => startResize(event, handle.corner)}
              style={{ touchAction: "none" }}
              className={cn(
                "absolute z-10 h-3.5 w-3.5 rounded-full border-2 border-white bg-navy-900 shadow",
                handle.className,
              )}
            />
          ))}

        {dragging && liveWidth && (
          <span className="absolute bottom-2 right-2 rounded-md bg-navy-900/85 px-2 py-0.5 text-[11px] font-medium tabular text-white">
            {liveWidth}px
          </span>
        )}

        {moving && (
          <span className="absolute bottom-2 right-2 rounded-md bg-navy-900/85 px-2 py-0.5 text-[11px] font-medium tabular text-white">
            {liveOffset.x >= 0 ? "+" : ""}
            {liveOffset.x} · {liveOffset.y >= 0 ? "+" : ""}
            {liveOffset.y}
          </span>
        )}
      </div>
    </NodeViewWrapper>
  );
}
