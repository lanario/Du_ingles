import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  submitted: "Enviada",
  graded: "Corrigida",
  late: "Atrasada",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-gold-50 text-gold-700 ring-gold-300/60",
  submitted: "bg-navy-50 text-navy-700 ring-navy-100",
  graded: "bg-success/10 text-success ring-success/30",
  late: "bg-destructive/10 text-destructive ring-destructive/30",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset",
        STATUS_TONE[status] ?? STATUS_TONE.pending,
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
