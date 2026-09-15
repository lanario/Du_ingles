"use client";

/**
 * A prévia que se desenrola ao lado do bloco sob o cursor.
 *
 * O painel de detalhe (`agenda-detail.tsx`) continua sendo o lugar de agir —
 * remarcar, excluir, entrar na sala. Isto aqui responde só a pergunta barata
 * que alguém faz passando o olho pela grade: *que aula é essa?*. Por isso o
 * conteúdo é curto e o gesto não tem clique nem foco roubado
 * (`pointer-events: none` no papiro inteiro).
 *
 * **Por que sai pela lateral e não por cima.** O cartão que se está olhando é
 * a referência; cobri-lo com a explicação dele mesmo é o defeito clássico do
 * tooltip de calendário. O papiro abre na horizontal, do lado com mais espaço,
 * e a altura é presa dentro da janela — o bloco das 21h abre para cima em vez
 * de empurrar a leitura para fora da tela.
 *
 * **Por que anima `width` e não `scaleX`.** Um `scaleX` de 0 a 1 esmaga e
 * estica o texto durante a abertura. Aqui o miolo tem largura fixa e quem
 * cresce é a máscara à volta dele: as letras nascem prontas, reveladas da
 * esquerda para a direita (ou o contrário, quando o papiro abre para a
 * esquerda — é o `direction: rtl` da máscara que ancora o miolo do lado certo).
 * O bastão colorido fica na borda que avança e viaja sozinho com ela.
 *
 * O papiro vive num portal no `<body>`: dentro da grade ele seria recortado
 * pelo `overflow` da rolagem. Como os tokens `--agenda-*` moram em
 * `.agenda-theme` (e a variante da coordenação depende de um ancestral com
 * `data-admin-theme`), o portal recria os dois invólucros — sem isso a prévia
 * sairia com as cores do aluno dentro do painel do admin.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./agenda-motion";
import {
  AUDIENCE_LABEL,
  KIND_SINGULAR,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_TONE,
  durationLabel,
  filterKindOf,
  shortDateLabel,
  tint,
  type PlacedItem,
} from "./agenda-utils";

/** Largura do miolo. Fixa: é ela que faz o texto não reflowar na abertura. */
const PEEK_WIDTH = 252;
/** Respiro entre o cartão e o papiro. */
const GAP = 12;
/** Folga mínima até a borda da janela. */
const MARGIN = 12;
/** Atraso antes de abrir — passar o mouse pela grade não dispara nada. */
const OPEN_DELAY = 140;

type Side = "right" | "left";

interface Spot {
  /** Muda a cada abertura e re-dispara a linha do tempo do GSAP. */
  id: number;
  side: Side;
  rect: { top: number; left: number; right: number };
  /** O cartão está dentro do tema da coordenação? */
  admin: boolean;
}

/**
 * Escolhe o lado: o que couber; havendo espaço dos dois, a direita, que é o
 * sentido natural de leitura. Se nenhum couber (grade espremida no celular),
 * fica com o lado mais folgado e o painel encosta na margem.
 */
function sideFor(rect: DOMRect): Side {
  const needed = PEEK_WIDTH + GAP + MARGIN;
  const right = window.innerWidth - rect.right;
  const left = rect.left;
  if (right >= needed) return "right";
  if (left >= needed) return "left";
  return right >= left ? "right" : "left";
}

// ------------------------------------------------------------- conteúdo ----

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[11px] leading-snug">
      <span className="w-14 shrink-0 text-[var(--agenda-muted-fg)]">{label}</span>
      <span className="min-w-0 flex-1 font-medium text-[var(--agenda-fg)]">{value}</span>
    </div>
  );
}

function PeekBody({ placed, tone }: { placed: PlacedItem; tone: string }) {
  const { item } = placed;
  const typeLabel = KIND_SINGULAR[filterKindOf(item)];
  const when = item.allDay
    ? "Dia inteiro"
    : `${placed.startLabel}–${placed.endLabel} · ${durationLabel(item.durationMinutes)}`;

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: tone }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--agenda-muted-fg)]">
          {typeLabel}
        </span>
        {item.kind === "session" && item.status && (
          <span
            className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{
              color: SESSION_STATUS_TONE[item.status],
              backgroundColor: tint(SESSION_STATUS_TONE[item.status], 14),
            }}
          >
            {SESSION_STATUS_LABEL[item.status]}
          </span>
        )}
      </div>

      <p
        className={cn(
          "text-sm font-semibold leading-tight text-[var(--agenda-fg)]",
          item.status === "cancelled" && "line-through",
        )}
      >
        {item.title}
      </p>

      <div className="flex flex-col gap-1">
        <Line label="Quando" value={`${shortDateLabel(placed.day)} · ${when}`} />
        {item.groupName && <Line label="Turma" value={item.groupName} />}
        {item.teacherName && <Line label="Professor" value={item.teacherName} />}
        {item.location && <Line label="Onde" value={item.location} />}
        {item.kind === "event" && item.audience && (
          <Line label="Para" value={AUDIENCE_LABEL[item.audience]} />
        )}
      </div>

      {item.description && (
        <p className="line-clamp-2 text-[11px] leading-snug text-[var(--agenda-muted-fg)]">
          {item.description}
        </p>
      )}

      <span className="text-[10px] font-medium text-[var(--agenda-muted-fg)] opacity-80">
        {item.kind === "preview"
          ? "Aula ainda não gerada · clique para ver"
          : "Clique para abrir o detalhe"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- gancho ---

/**
 * Devolve os eventos que o bloco espalha (`...hoverProps`) e o nó do papiro
 * para renderizar (`node`). O teclado entra pela mesma porta: quem chega no
 * cartão com Tab vê a mesma prévia.
 */
export function useAgendaPeek(placed: PlacedItem, tone: string) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const close = useCallback(() => {
    clearTimer();
    const root = rootRef.current;
    const clip = clipRef.current;
    if (!root || !clip || prefersReducedMotion()) {
      setSpot(null);
      return;
    }
    gsap.killTweensOf([root, clip]);
    gsap.to(clip, { width: 0, duration: 0.16, ease: "power2.in" });
    gsap.to(root, {
      opacity: 0,
      duration: 0.16,
      onComplete: () => setSpot(null),
    });
  }, []);

  const open = useCallback((element: HTMLElement) => {
    clearTimer();
    timer.current = window.setTimeout(() => {
      const rect = element.getBoundingClientRect();
      seq.current += 1;
      setSpot({
        id: seq.current,
        side: sideFor(rect),
        rect: { top: rect.top, left: rect.left, right: rect.right },
        admin: Boolean(element.closest("[data-admin-theme]")),
      });
    }, OPEN_DELAY);
  }, []);

  useEffect(() => clearTimer, []);

  // Rolar a grade move o cartão e o papiro ficaria apontando para o vazio:
  // posição fixa não acompanha um scroller interno. Fechar é mais honesto do
  // que reposicionar a cada quadro.
  useEffect(() => {
    if (!spot) return;
    const dismiss = () => setSpot(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [spot]);

  useLayoutEffect(() => {
    if (!spot) return;
    const root = rootRef.current;
    const clip = clipRef.current;
    const inner = innerRef.current;
    if (!root || !clip || !inner) return;

    // O miolo já está medido (largura fixa); só agora dá para saber a altura
    // e prender o papiro dentro da janela.
    const height = inner.offsetHeight;
    const maxTop = Math.max(MARGIN, window.innerHeight - MARGIN - height);
    root.style.top = `${Math.min(Math.max(spot.rect.top - 4, MARGIN), maxTop)}px`;

    const limit = Math.max(MARGIN, window.innerWidth - MARGIN - PEEK_WIDTH);
    if (spot.side === "right") {
      root.style.left = `${Math.min(spot.rect.right + GAP, limit)}px`;
      root.style.right = "auto";
    } else {
      root.style.right = `${Math.min(window.innerWidth - spot.rect.left + GAP, limit)}px`;
      root.style.left = "auto";
    }

    if (prefersReducedMotion()) {
      gsap.set(root, { opacity: 1 });
      gsap.set(clip, { width: PEEK_WIDTH });
      return;
    }

    const timeline = gsap.timeline();
    timeline
      .fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.14, ease: "none" }, 0)
      .fromTo(
        clip,
        { width: 0 },
        { width: PEEK_WIDTH, duration: 0.44, ease: "power3.out" },
        0,
      )
      // O bastão nasce curto e se estica até a altura cheia, como um rolo solto.
      .fromTo(
        root.querySelectorAll("[data-peek-rod]"),
        { scaleY: 0.35 },
        { scaleY: 1, duration: 0.3, ease: "power2.out" },
        0,
      );

    return () => {
      timeline.kill();
    };
  }, [spot]);

  const hoverProps = {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => open(event.currentTarget),
    onMouseLeave: close,
    onFocus: (event: React.FocusEvent<HTMLElement>) => open(event.currentTarget),
    onBlur: close,
  };

  const node =
    spot && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={rootRef}
            aria-hidden
            className="pointer-events-none fixed z-[70] opacity-0"
            {...(spot.admin ? { "data-admin-theme": "" } : {})}
          >
            <div className="agenda-theme relative">
              <div
                ref={clipRef}
                className="overflow-hidden rounded-xl border bg-[var(--agenda-surface)] shadow-[0_14px_38px_rgba(11,26,51,0.18)]"
                style={{
                  width: 0,
                  direction: spot.side === "right" ? "ltr" : "rtl",
                  borderColor: tint(tone, 34),
                }}
              >
                <div ref={innerRef} style={{ width: PEEK_WIDTH, direction: "ltr" }}>
                  <PeekBody placed={placed} tone={tone} />
                </div>
              </div>
              <span
                data-peek-rod
                aria-hidden
                className="absolute top-0 h-full w-[3px] rounded-full"
                style={{
                  backgroundColor: tone,
                  boxShadow: `0 0 10px ${tint(tone, 55)}`,
                  ...(spot.side === "right" ? { right: -1 } : { left: -1 }),
                }}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return { hoverProps, node, closePeek: close };
}
