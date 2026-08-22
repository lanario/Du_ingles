"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "du_cookie_consent";

/** LGPD (§11.5): aviso de cookies público. Sem cookies não-essenciais hoje
 * — o banner existe para transparência e fica pronto para quando entrarem.
 *
 * Ele mora no `z-50`, acima da barra de CTA e do botão de topo: enquanto o
 * aviso está na tela, ele é a única coisa que importa na base da janela. */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  useEffect(() => {
    // A barra de CTA e o botão "voltar ao topo" se afastam da base enquanto o
    // aviso ocupa o rodapé — sem isso os três se empilham no mesmo canto.
    document.documentElement.classList.toggle("has-cookie-notice", visible);
    return () => document.documentElement.classList.remove("has-cookie-notice");
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
          Usamos cookies essenciais para o funcionamento do site. Veja nossa{" "}
          <Link href="/privacidade" className="underline">
            política de privacidade
          </Link>
          .
        </p>
        <Button
          className="w-full shrink-0 min-h-12 sm:min-h-0 sm:w-auto"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "accepted");
            setVisible(false);
          }}
        >
          Entendi
        </Button>
      </div>
    </div>
  );
}
