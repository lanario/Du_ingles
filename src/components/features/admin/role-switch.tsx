"use client";

import { useId, useRef, useState, useTransition } from "react";
import { enterViewAsModeAction, exitViewAsModeAction } from "@/actions/admin/view-as";
import { cn } from "@/lib/utils";

export type AwayRole = "teacher" | "student";

interface RoleSwitchProps {
  /** Lado em que o switch está agora: "admin" (painel) ou "away" (pré-visualizando professor/aluno). */
  active: "admin" | "away";
  /** Rótulo do lado não-admin, já traduzido para o papel efetivo atual. */
  awayLabel: string;
  /**
   * Papel para o qual entrar ao ligar o switch a partir do admin. Só é lido
   * quando `active === "admin"` — dentro da área do professor/aluno o switch
   * só tem uma direção possível (voltar).
   */
  awayRole?: AwayRole;
  /**
   * Encolhe a chave para caber no rail de 64px da sidebar do aluno/professor:
   * a trilha vira um botão redondo com só o glifo. Os rótulos some, mas nessa
   * largura o estado nunca é ambíguo — dentro da área do aluno a chave só tem
   * uma direção possível (voltar para o admin).
   */
  collapsed?: boolean;
  /** Paleta clara, para a sidebar do aluno/professor (o padrão é o chrome navy do admin). */
  tone?: "dark" | "light";
  className?: string;
}

/**
 * Chave estilo iOS/Uiverse para o admin alternar entre o próprio painel e a
 * pré-visualização de professor/aluno. Cada lado é um `<form>` de Server
 * Action escondido — clicar dispara `requestSubmit()` no form certo, então o
 * estado real sempre vem do cookie assinado no servidor (mesmo contrato do
 * `ContextSwitcher`), nunca de estado local que poderia dessincronizar.
 *
 * Some ao trocar de área porque a navegação (`redirect`) troca a página
 * inteira — não precisa reconciliar estado "de volta" no cliente.
 */
export function RoleSwitch({
  active,
  awayLabel,
  awayRole = "student",
  collapsed = false,
  tone = "dark",
  className,
}: RoleSwitchProps) {
  const inputId = useId();
  const enterFormRef = useRef<HTMLFormElement>(null);
  const exitFormRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<"admin" | "away" | null>(null);

  const checked = (optimistic ?? active) === "away";

  function handleChange() {
    if (pending) return;
    const goingAway = !checked;
    setOptimistic(goingAway ? "away" : "admin");
    startTransition(() => {
      if (goingAway) {
        enterFormRef.current?.requestSubmit();
      } else {
        exitFormRef.current?.requestSubmit();
      }
    });
  }

  return (
    <div className={cn("relative inline-flex", className)}>
      <form ref={enterFormRef} action={enterViewAsModeAction} className="hidden">
        <input type="hidden" name="role" value={awayRole} />
      </form>
      <form ref={exitFormRef} action={exitViewAsModeAction} className="hidden" />

      <label
        htmlFor={inputId}
        title={checked ? "Voltar para o painel admin" : `Ver como ${awayLabel}`}
        className={cn(
          "group relative flex h-12 flex-none cursor-pointer select-none items-center rounded-full p-1",
          "border transition-[background-color,border-color] duration-300",
          collapsed && "w-12",
          checked
            ? "border-gold-300 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400"
            : tone === "light"
              ? "border-navy-200 bg-navy-50"
              : "border-navy-700 bg-navy-900",
          pending && "opacity-70",
        )}
      >
        <input
          id={inputId}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={pending}
          onChange={handleChange}
          aria-label={checked ? `Voltar para Admin` : `Pré-visualizar como ${awayLabel}`}
          className="sr-only"
        />

        {/* Os rótulos ficam no fluxo (não absolutos), então a trilha nasce da
            largura do texto — "Professor" alarga o switch em vez de vazar dele.
            O padding lateral de 2,75rem é a vaga da bolinha, e troca de lado
            junto com ela: os dois rótulos ficam sempre legíveis, nenhum fica
            por baixo do glifo. */}
        {!collapsed && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none flex items-center gap-3 text-[10px] font-semibold uppercase",
              "transition-[padding] duration-300 ease-out",
              checked ? "pl-3 pr-[2.75rem]" : "pl-[2.75rem] pr-3",
            )}
          >
            <span
              className={cn(
                "whitespace-nowrap transition-colors",
                checked
                  ? "text-navy-950/60"
                  : tone === "light"
                    ? "text-navy-900"
                    : "text-white",
              )}
            >
              Admin
            </span>
            <span
              className={cn(
                "whitespace-nowrap transition-colors",
                checked
                  ? "text-navy-950"
                  : tone === "light"
                    ? "text-navy-900/40"
                    : "text-white/40",
              )}
            >
              {awayLabel}
            </span>
          </span>
        )}

        {/* Bolinha ancorada por `left` (com `calc`) em vez de um translate fixo —
            acompanha qualquer largura de trilha sem recalcular a distância. */}
        <span
          aria-hidden
          className={cn(
            "absolute top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md",
            "transition-[left] duration-300 ease-out",
            checked && !collapsed ? "left-[calc(100%-2.75rem)]" : "left-1",
          )}
        >
          <RoleGlyph away={checked} />
        </span>
      </label>
    </div>
  );
}

function RoleGlyph({ away }: { away: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke={away ? "#c9a227" : "#0a1f44"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {away ? (
        <>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </>
      ) : (
        <>
          <path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6Z" />
          <path d="M9.5 12l1.8 1.8L15 10" />
        </>
      )}
    </svg>
  );
}
