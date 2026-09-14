"use client";

import { useEffect, useState } from "react";
import { PERF_STORAGE_KEY, type PerfMode } from "@/lib/perf";
import {
  accountClasses,
  type AccountTheme,
} from "@/components/features/account/account-theme";
import { cn } from "@/lib/utils";

/**
 * Chave do modo leve.
 *
 * A detecção automática (`lib/perf.ts`) acerta a maioria dos casos, mas ela
 * chuta: Safari e Firefox não contam memória nem núcleo, e um computador pode
 * estar lento por motivo que navegador nenhum enxerga — antivírus varrendo,
 * vinte abas abertas, a própria aula em videochamada do lado. Quem está na
 * frente da máquina sabe; esta chave existe para ele decidir.
 *
 * A preferência vale só neste aparelho (fica no `localStorage`): a mesma conta
 * pode ser usada no laptop da escola e no celular novo, e o que trava um não
 * trava o outro.
 */
export function PerformancePanel({ theme = "app" }: { theme?: AccountTheme }) {
  const classes = accountClasses(theme);
  const [choice, setChoice] = useState<PerfMode | "auto">("auto");
  const [lite, setLite] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(PERF_STORAGE_KEY);
    setChoice(saved === "lite" || saved === "full" ? saved : "auto");
    setLite(document.documentElement.getAttribute("data-perf") === "lite");
  }, []);

  function apply(next: PerfMode | "auto") {
    setChoice(next);
    try {
      if (next === "auto") window.localStorage.removeItem(PERF_STORAGE_KEY);
      else window.localStorage.setItem(PERF_STORAGE_KEY, next);
    } catch {
      // Modo privado: a escolha vale para esta visita e não é lembrada.
    }

    // `data-perf` é o que o CSS e os componentes leem — escrever aqui aplica a
    // troca na hora, sem recarregar. No "automático" a detecção só volta a
    // rodar no próximo carregamento, então mantemos o que está valendo.
    if (next === "auto") return;
    const root = document.documentElement;
    if (next === "lite") root.setAttribute("data-perf", "lite");
    else root.removeAttribute("data-perf");
    setLite(next === "lite");
  }

  const options: { value: PerfMode | "auto"; label: string; hint: string }[] = [
    {
      value: "auto",
      label: "Automático",
      hint: "Decide sozinho pelo aparelho. É o padrão.",
    },
    {
      value: "lite",
      label: "Modo leve",
      hint: "Desliga desfoque, sombra e animação. Nada de conteúdo muda.",
    },
    {
      value: "full",
      label: "Completo",
      hint: "Mantém todos os efeitos visuais.",
    },
  ];

  return (
    <section className={classes.card}>
      <h2 className={classes.heading}>Desempenho</h2>
      <p className={cn("mt-1", classes.muted)}>
        Se a tela estiver lenta ou travando neste aparelho, o modo leve costuma resolver.
        Ele tira só o enfeite — todas as telas, botões e informações continuam exatamente
        onde estão.
      </p>

      <div className="mt-4 space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
              choice === option.value
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/60",
            )}
          >
            <input
              type="radio"
              name="perf-mode"
              value={option.value}
              checked={choice === option.value}
              onChange={() => apply(option.value)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.label}</span>
              <span className={cn("block text-xs", classes.muted)}>{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <p className={cn("mt-3 text-xs", classes.muted)}>
        Agora: <strong>{lite ? "modo leve" : "completo"}</strong>. A escolha vale só neste
        aparelho.
      </p>
    </section>
  );
}
