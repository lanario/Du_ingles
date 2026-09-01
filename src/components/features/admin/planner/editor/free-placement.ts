"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Geometria dos objetos que o professor posiciona com o mouse na folha —
 * imagem e caixa de texto. As duas se movem do mesmo jeito, então a conta
 * mora aqui uma vez só.
 *
 * Um objeto pode estar NO FLUXO (empurra o texto, como um parágrafo) ou
 * SOLTO (`free`): âncora de altura zero no lugar onde ele está no documento e
 * a figura flutuando por cima do papel a partir dela. Solto, o deslocamento é
 * um `translate` sobre essa âncora — nunca uma margem: a figura anda pela
 * folha sem reservar espaço nem empurrar o que está em volta.
 */

/** Abaixo disto o gesto ainda é um clique — arrastar só começa depois. */
export const MOVE_THRESHOLD = 4;
/** Folga que o objeto pode sair da coluna de texto, para cada lado. */
export const FREE_PLAY_X = 200;
export const LIMIT_Y = 1400;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export interface Offset {
  x: number;
  y: number;
}

/**
 * `transform` do objeto. Solto e centralizado, a âncora é `left: 50%` — o
 * `-50%` aqui é o que recoloca a figura sobre o meio da coluna.
 */
export function freeTransform(
  align: string | null,
  offset: Offset,
  free: boolean,
): string | undefined {
  if (!free) {
    return offset.x || offset.y ? `translate(${offset.x}px, ${offset.y}px)` : undefined;
  }
  const anchor = align === "center" ? "-50%" : "0px";
  return `translate(calc(${anchor} + ${offset.x}px), ${offset.y}px)`;
}

/** Lado ao qual a figura solta se prende dentro da âncora de altura zero. */
export function freeAnchorStyle(align: string | null): CSSProperties {
  if (align === "right") return { right: 0 };
  if (align === "center") return { left: "50%" };
  return { left: 0 };
}

export interface UseFreeMoveOptions {
  /** Elemento que anda na tela (a figura, não a âncora). */
  targetRef: { current: HTMLElement | null };
  align: string | null;
  free: boolean;
  offsetX: number;
  offsetY: number;
  editable: boolean;
  /** Chamado ao soltar, só quando o arrasto realmente aconteceu. */
  onCommit: (offset: Offset) => void;
}

/**
 * Arrastar para mover. O desenho acontece no DOM durante o gesto (uma
 * transação do ProseMirror por pixel encheria o histórico de desfazer) e só
 * vira atributo do documento quando o ponteiro solta.
 *
 * Os listeners moram na janela, e não no elemento: o punho que iniciou o
 * arrasto costuma sumir assim que ele começa (a barrinha se esconde para não
 * tampar o objeto), e um listener num elemento desmontado morre no meio do
 * caminho.
 */
export function useFreeMove({
  targetRef,
  align,
  free,
  offsetX,
  offsetY,
  editable,
  onCommit,
}: UseFreeMoveOptions) {
  const [moving, setMoving] = useState(false);
  const [offset, setOffset] = useState<Offset>({ x: offsetX, y: offsetY });

  // O deslocamento tem `0` como padrão no schema, então o valor que vem do
  // documento é sempre um número — dá para espelhar direto.
  useEffect(() => {
    setOffset({ x: offsetX, y: offsetY });
  }, [offsetX, offsetY]);

  // O gesto lê a âncora e o modo no momento do arrasto, não no do render que
  // criou o listener.
  const layout = useRef({ align, free });
  layout.current = { align, free };

  const startMove = useCallback(
    (origin: { clientX: number; clientY: number; pointerId: number }) => {
      if (!editable) return;
      const target = targetRef.current;
      if (!target) return;

      const baseX = offsetX;
      const baseY = offsetY;
      const columnWidth = target.parentElement?.getBoundingClientRect().width ?? 900;
      const ownWidth = target.getBoundingClientRect().width;
      // O objeto passeia pelo espaço que sobra da coluna, mais uma folga para
      // cada lado — o bastante para escapar do texto sem sumir atrás da borda
      // da folha, que corta o que passa dela.
      const limitX = Math.max((columnWidth - ownWidth) / 2, 0) + FREE_PLAY_X;

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
            target.setPointerCapture(origin.pointerId);
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
          target.style.transform =
            freeTransform(layout.current.align, next, layout.current.free) ?? "";
          setOffset(next);
        });
      };

      const finish = (endEvent: PointerEvent) => {
        if (endEvent.pointerId !== origin.pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        if (frame) window.cancelAnimationFrame(frame);
        if (target.hasPointerCapture(origin.pointerId)) {
          target.releasePointerCapture(origin.pointerId);
        }
        if (!started) return;

        setMoving(false);
        setOffset(next);
        onCommit(next);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [editable, offsetX, offsetY, onCommit, targetRef],
  );

  return { moving, offset, setOffset, startMove };
}
