export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "inline-flex items-center gap-1.5 text-xs text-emerald-500"
          : "inline-flex items-center gap-1.5 text-xs text-admin-foreground/50"
      }
    >
      <span
        aria-hidden
        className={
          isActive
            ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
            : "h-1.5 w-1.5 rounded-full bg-admin-foreground/40"
        }
      />
      {isActive ? "Ativo" : "Inativo"}
    </span>
  );
}
