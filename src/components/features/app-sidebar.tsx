import Link from "next/link";
import type { AppRole } from "@/types/domain";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Início", roles: ["teacher", "student"] },
  { href: "/planos-de-aula", label: "Planos de aula", roles: ["teacher"] },
  { href: "/tarefas", label: "Tarefas", roles: ["teacher", "student"] },
  { href: "/progresso", label: "Meu progresso", roles: ["student"] },
  { href: "/biblioteca", label: "Biblioteca", roles: ["teacher", "student"] },
  { href: "/mensagens", label: "Mensagens", roles: ["teacher", "student"] },
  { href: "/meus-dados", label: "Meus dados", roles: ["teacher", "student"] },
] as const;

export function AppSidebar({ role }: { role: AppRole }) {
  const items = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(role),
  );

  return (
    <nav className="hidden w-56 flex-none border-r border-border p-4 md:block">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
