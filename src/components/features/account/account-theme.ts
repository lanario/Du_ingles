/**
 * As telas de conta existem nas duas áreas (aluno/professor e admin) com o
 * mesmo conteúdo e chromes diferentes. Em vez de duplicar as páginas, cada
 * peça recebe `theme` e pega daqui as classes que mudam — mesmo contrato que
 * o `LgpdPanel` já usa.
 */

export type AccountTheme = "app" | "admin";

export function accountClasses(theme: AccountTheme) {
  const admin = theme === "admin";
  return {
    card: admin
      ? "rounded-lg border border-admin-border p-5"
      : "rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)]",
    heading: admin ? "font-semibold" : "font-semibold text-navy-900",
    muted: admin ? "text-sm text-admin-foreground/70" : "text-sm text-muted-foreground",
    primaryButton: admin
      ? "bg-admin-accent text-admin-accent-foreground hover:opacity-90"
      : "bg-primary text-primary-foreground hover:opacity-90",
  };
}
