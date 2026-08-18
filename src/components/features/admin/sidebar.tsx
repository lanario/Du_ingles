import Link from "next/link";

const NAV_ITEMS = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/cursos", label: "Cursos" },
  { href: "/admin/turmas", label: "Turmas" },
  { href: "/admin/relatorios", label: "Relatórios" },
  { href: "/admin/mensagens", label: "Mensagens" },
  { href: "/admin/ver-como", label: "Ver como Professor" },
  { href: "/admin/auditoria", label: "Auditoria" },
  { href: "/admin/meus-dados", label: "Meus dados" },
] as const;

export function AdminSidebar() {
  return (
    <nav className="hidden w-56 flex-none border-r border-admin-border p-4 md:block">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-admin-foreground/80 hover:bg-admin-muted hover:text-admin-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
