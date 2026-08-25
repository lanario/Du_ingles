import { enterViewAsModeAction, exitViewAsModeAction } from "@/actions/admin/view-as";
import { cn } from "@/lib/utils";

export type ViewContext = "admin" | "student";

const LABELS: Record<ViewContext, string> = {
  admin: "Admin",
  student: "Aluno",
};

/**
 * Alternador de contexto do admin. Cada segmento é um `<form>` com Server
 * Action — sem JS no cliente e sem estado local, então o contexto exibido é
 * sempre o que o cookie assinado diz, nunca o que o React acha que é.
 *
 * Voltar para "Admin" apaga o cookie (`exitViewAsModeAction`); "Aluno" o
 * reemite. O professor não aparece aqui: virou área própria (`/professor`),
 * com papel de verdade, não um contexto que o admin veste.
 */
export function ContextSwitcher({
  current,
  variant = "shell",
}: {
  current: ViewContext;
  variant?: "shell" | "banner";
}) {
  const wrapper =
    variant === "shell"
      ? "border-admin-shell-border bg-admin-shell-muted"
      : "border-navy-900/20 bg-navy-900/10";

  return (
    <div
      className={cn("flex items-center gap-0.5 rounded-lg border p-0.5", wrapper)}
      role="group"
      aria-label="Contexto de visualização"
    >
      {(Object.keys(LABELS) as ViewContext[]).map((context) => {
        const active = context === current;
        const className = cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          active && variant === "shell" && "bg-navy-900 text-white",
          active && variant === "banner" && "bg-navy-900 text-white",
          !active &&
            variant === "shell" &&
            "text-admin-shell-foreground/70 hover:bg-admin-shell-foreground/10 hover:text-admin-shell-foreground",
          !active && variant === "banner" && "text-navy-900/70 hover:bg-white/40",
        );

        if (active) {
          return (
            <span key={context} className={className} aria-current="true">
              {LABELS[context]}
            </span>
          );
        }

        if (context === "admin") {
          return (
            <form key={context} action={exitViewAsModeAction}>
              <button type="submit" className={className}>
                {LABELS[context]}
              </button>
            </form>
          );
        }

        return (
          <form key={context} action={enterViewAsModeAction}>
            <input type="hidden" name="role" value={context} />
            <button type="submit" className={className}>
              {LABELS[context]}
            </button>
          </form>
        );
      })}
    </div>
  );
}
