import type { AutosaveStatus } from "@/hooks/use-autosave";

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
          ? "text-sm font-medium text-destructive"
          : "text-sm text-muted-foreground"
      }
    >
      {text}
    </span>
  );
}
