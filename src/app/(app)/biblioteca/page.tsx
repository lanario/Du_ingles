import type { Metadata } from "next";
import { listLibraryEntries, listMyGroupsForFilter } from "@/repositories/library";
import { LibraryFilter } from "@/components/features/library/library-filter";
import { LibraryGrid } from "@/components/features/library/library-grid";

export const metadata: Metadata = { title: "Biblioteca" };

interface PageProps {
  searchParams: Promise<{ turma?: string }>;
}

export default async function BibliotecaPage({ searchParams }: PageProps) {
  const { turma } = await searchParams;
  const [entries, groups] = await Promise.all([
    listLibraryEntries(turma),
    listMyGroupsForFilter(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy-900">Biblioteca</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Material das aulas já realizadas, em PDF.
      </p>

      {groups.length > 1 && <LibraryFilter groups={groups} selected={turma} />}

      <LibraryGrid entries={entries} />
    </div>
  );
}
