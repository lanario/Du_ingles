"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectGoogleAction } from "@/actions/shared/google";
import { Button, buttonVariants } from "@/components/ui/button";
import type { GoogleStatus } from "@/lib/google/connection";
import { cn } from "@/lib/utils";

const NOTICES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  conectado: {
    tone: "ok",
    text: "Google Agenda conectado. Suas aulas estão sendo enviadas para a sua agenda.",
  },
  cancelado: { tone: "warn", text: "Conexão cancelada. Nada foi alterado." },
  erro: { tone: "warn", text: "Não foi possível conectar ao Google. Tente de novo." },
  indisponivel: { tone: "warn", text: "A integração com o Google ainda não está ativa." },
};

/**
 * Botão da agenda: conecta (ou desconecta) o Google Agenda de quem está
 * logado. Conectar é um LINK para `/api/google/connect`, não um formulário —
 * o CSP da plataforma só aceita `form-action 'self'`.
 */
export function GoogleConnect({
  status,
  notice,
  className,
}: {
  status: GoogleStatus;
  /** Valor de `?google=` que o retorno do Google deixou na URL. */
  notice?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!status.available) return null;

  const message = notice ? NOTICES[notice] : undefined;

  function disconnect() {
    if (
      !window.confirm(
        "Desconectar o Google Agenda? As aulas enviadas serão removidas da sua agenda Google.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await disconnectGoogleAction();
      if (!result.success) setError(result.error.message);
      router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-3">
        {status.connected ? (
          <>
            <span className="inline-flex items-center gap-2 text-sm">
              <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
              Google Agenda conectado
            </span>
            <Button
              variant="outline"
              className="h-9"
              onClick={disconnect}
              disabled={pending}
            >
              {pending ? "Desconectando…" : "Desconectar"}
            </Button>
          </>
        ) : (
          <a href="/api/google/connect" className={buttonVariants("outline", "h-9")}>
            {status.revoked ? "Reconectar Google Agenda" : "Conectar Google Agenda"}
          </a>
        )}
      </div>

      {!status.connected && (
        <p className="text-xs text-muted-foreground">
          {status.revoked
            ? "O Google recusou o acesso anterior. Reconecte para voltar a receber as aulas."
            : "Envia suas aulas para o Google Agenda, com lembrete e link do Meet."}
        </p>
      )}
      {message && (
        <p
          role="status"
          className={cn(
            "text-xs",
            message.tone === "ok" ? "text-emerald-600" : "text-amber-600",
          )}
        >
          {message.text}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
