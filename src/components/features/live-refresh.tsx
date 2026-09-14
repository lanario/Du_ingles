"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePerfMode } from "@/hooks/use-perf-mode";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  isSelfWrite,
  streamsForPath,
  tablesFor,
  type LiveStream,
} from "@/lib/realtime/streams";

/**
 * Janela de agrupamento das escritas antes de revalidar.
 *
 * Em modo leve a janela é bem maior: revalidar é re-renderizar a rota inteira,
 * e num processador fraco isso aparece como travada. Um tempo real de 2,5s em
 * vez de 0,35s continua sendo tempo real para quem está olhando — e devolve à
 * máquina o fôlego entre uma reconstrução e outra.
 */
const DEBOUNCE_MS = 350;
const DEBOUNCE_LITE_MS = 2500;

/**
 * Mantém a tela viva: quando alguém escreve numa tabela que interessa à rota
 * atual, a página se revalida sozinha.
 *
 * É montado uma única vez por área, no layout. Ele lê a rota e consulta
 * `streamsForPath` — então navegar de /agenda para /tarefas troca a assinatura
 * sem remontar nada, e uma página nova entra no tempo real só de ser listada
 * em `lib/realtime/streams.ts`.
 *
 * Por que `router.refresh()` e não desenhar o payload do evento: o evento traz
 * a LINHA crua, não o que a página monta (nome da turma, nota calculada,
 * prévia da grade, o recorte de quem está olhando). Revalidar devolve
 * exatamente o que aquele usuário veria num F5 — sem reimplementar no cliente
 * regra nenhuma que já existe no servidor — e preserva o estado local: quem
 * está digitando não perde o que escreveu.
 *
 * Três cuidados que ele toma sozinho:
 *
 *   - **Debounce.** Uma ação única costuma escrever várias linhas (marcar
 *     chamada grava uma por aluno). Sem a janela seriam N revalidações.
 *   - **Aba escondida.** Em segundo plano a revalidação fica pendente e roda
 *     quando a aba volta — nada de dez abas abertas pedindo render à toa.
 *   - **Assinatura estável.** Os assuntos viram uma chave de texto, então o
 *     canal só é refeito quando a rota muda de assunto de verdade.
 */
export function LiveRefresh({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { lite } = usePerfMode();
  const key = [...new Set(streamsForPath(pathname))].sort().join(",");

  useEffect(() => {
    if (!key) return;

    const tables = tablesFor(key.split(",") as LiveStream[]);
    const supabase = createBrowserSupabaseClient();

    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = false;

    function flush() {
      timer = null;
      if (document.hidden) {
        pending = true;
        return;
      }
      pending = false;
      router.refresh();
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, lite ? DEBOUNCE_LITE_MS : DEBOUNCE_MS);
    }

    function onVisibility() {
      if (!document.hidden && pending) flush();
    }

    const channel = supabase.channel(
      `live:${key}:${Math.random().toString(36).slice(2)}`,
    );
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          // Escrita do próprio usuário não revalida: o autosave dele mandaria a
          // página se refazer no meio da digitação, e a action que ele acabou de
          // rodar já revalidou o que precisava.
          if (isSelfWrite(table, payload.new, userId)) return;
          schedule();
        },
      );
    }
    channel.subscribe();

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [key, router, userId, lite]);

  return null;
}
