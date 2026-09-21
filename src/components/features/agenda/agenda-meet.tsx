"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

/** setTimeout estoura acima de ~24 dias; além de 1 dia não vale a pena esperar aqui. */
const MAX_WAIT_MS = 24 * 3_600_000;

/**
 * Link do Google Meet da aula.
 *
 * Quem decide se o link existe para este visitante é o SERVIDOR
 * (`lib/google/meet-access.ts`): o aluno só recebe `meetUrl` a partir de 30 min
 * antes. Aqui só se desenha — e, enquanto o link não chegou, se agenda um
 * `router.refresh()` para o instante da liberação, sem o aluno recarregar.
 */
export function AgendaMeet({
  meetUrl,
  opensAt,
  endsAt,
  className,
}: {
  meetUrl: string | null;
  /** Quando o link abre para o aluno; `null` se a aula não tem Meet (cancelada, compromisso). */
  opensAt: string | null;
  endsAt: string;
  className?: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (meetUrl || !opensAt) return;
    const wait = new Date(opensAt).getTime() - Date.now();
    if (wait <= 0 || wait > MAX_WAIT_MS) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
      router.refresh();
    }, wait + 500);
    return () => clearTimeout(timer);
  }, [meetUrl, opensAt, router]);

  if (meetUrl) {
    return (
      <div className={className}>
        <a
          href={meetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants("primary", "w-full sm:w-auto")}
        >
          Entrar no Google Meet
        </a>
      </div>
    );
  }

  if (!opensAt) return null;
  const opens = new Date(opensAt).getTime();
  const over = now > new Date(endsAt).getTime();
  if (over) return null;

  return (
    <p className={className ?? "text-sm text-muted-foreground"} role="status">
      {now < opens
        ? "O link do Google Meet é liberado 30 minutos antes da aula."
        : "O link do Google Meet ainda não está disponível. Fale com o seu professor."}
    </p>
  );
}
