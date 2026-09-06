import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listLibraryEntries, listMyGroupsForFilter } from "@/repositories/library";
import { LibraryView } from "@/components/features/library/library-view";

export const metadata: Metadata = { title: "Biblioteca" };

interface PageProps {
  searchParams: Promise<{ turma?: string }>;
}

export default async function BibliotecaPage({ searchParams }: PageProps) {
  const { turma } = await searchParams;
  const ctx = await requireRole(["teacher", "student"]);

  // A estante do aluno é só o que *ele* teve — o recorte por matrícula mora no
  // repositório e depende de saber de quem é a estante.
  //
  // O papel testado é o **real**, não o efetivo: o "ver como aluno" do admin é
  // uma lente sobre a interface, não uma matrícula. Filtrar pelo `userId` dele
  // devolveria uma estante vazia (admin não tem matrícula) e esconderia a tela
  // que ele foi conferir. Sem filtro, ele continua vendo o que a política de
  // admin já lhe permite.
  const studentId = ctx.realRole === "student" ? ctx.userId : undefined;

  const [entries, groups] = await Promise.all([
    listLibraryEntries(turma, studentId),
    listMyGroupsForFilter(),
  ]);

  return <LibraryView entries={entries} groups={groups} selectedGroupId={turma} />;
}
