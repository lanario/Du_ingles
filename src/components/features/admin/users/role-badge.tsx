import type { AppRole } from "@/types/domain";

const LABEL: Record<AppRole, string> = {
  admin: "Admin",
  teacher: "Professor",
  student: "Aluno",
};

export function RoleBadge({ role }: { role: AppRole }) {
  return (
    <span className="inline-flex rounded-full bg-admin-muted px-2.5 py-0.5 text-xs font-medium text-admin-foreground/80">
      {LABEL[role]}
    </span>
  );
}
