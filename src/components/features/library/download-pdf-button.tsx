"use client";

import { useState, useTransition } from "react";
import { getSessionPdfUrlAction } from "@/actions/shared/session-pdf";
import { DownloadIcon } from "@/components/ui/icons";

export function DownloadPdfButton({
  sessionId,
  hasPdf,
}: {
  sessionId: string;
  hasPdf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!hasPdf) {
    return <span className="text-xs text-muted-foreground">PDF em preparo…</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await getSessionPdfUrlAction(sessionId);
            if (!result.success) {
              setError(result.error.message);
              return;
            }
            window.open(result.data, "_blank", "noopener,noreferrer");
          });
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-700 transition-colors hover:text-navy-900 disabled:opacity-50"
      >
        <DownloadIcon className="h-4 w-4" />
        {isPending ? "Gerando link…" : "Baixar PDF"}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
