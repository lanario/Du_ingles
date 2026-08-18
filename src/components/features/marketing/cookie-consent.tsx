"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "du_cookie_consent";

/** LGPD (§11.5): aviso de cookies público. Sem cookies não-essenciais hoje
 * — o banner existe para transparência e fica pronto para quando entrarem. */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Usamos cookies essenciais para o funcionamento do site. Veja nossa{" "}
          <Link href="/privacidade" className="underline">
            política de privacidade
          </Link>
          .
        </p>
        <Button
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
