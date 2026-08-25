import type { AutosaveStatus } from "@/hooks/use-autosave";
import { LogoLoader } from "@/components/ui/logo-loader";

const LABEL: Record<AutosaveStatus, string> = {
  idle: "",
  pending: "Alterações não salvas",
  saving: "Salvando…",
  saved: "Salvo",
  error: "Falha ao salvar — tentando novamente",
};

export function AutosaveIndicator({
  status,
  lastSavedAt,
}: {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
}) {
  const text =
    status === "saved" && lastSavedAt
      ? `Salvo às ${lastSavedAt.toLocaleTimeString("pt-BR")}`
      : LABEL[status];

  if (!text) return null;

  return (
    <span
      role="status"
      className={
        status === "error"
          ? "inline-flex items-center gap-2 text-sm font-medium text-destructive"
          : "inline-flex items-center gap-2 text-sm text-muted-foreground"
      }
    >
      {/* Só o salvamento em curso ganha a marca; "salvo" e "não salvo" são
          estados parados, e um loader neles diria o contrário. */}
      {status === "saving" && <LogoLoader size={14} label={null} />}
      {text}
    </span>
  );
}
