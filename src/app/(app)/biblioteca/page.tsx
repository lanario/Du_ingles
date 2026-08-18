import type { Metadata } from "next";
import { listLibraryEntries, listMyGroupsForFilter } from "@/repositories/library";
import { DownloadPdfButton } from "@/components/features/library/download-pdf-button";
import { LibraryFilter } from "@/components/features/library/library-filter";

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
      <h1 className="text-2xl font-semibold">Biblioteca</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Material das aulas já realizadas, em PDF.
      </p>

      {groups.length > 1 && <LibraryFilter groups={groups} selected={turma} />}

      {entries.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          Nenhuma aula publicada ainda.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-border p-4">
              <p className="font-medium">{entry.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.groupName} ·{" "}
                {new Date(entry.scheduledAt).toLocaleDateString("pt-BR")}
              </p>
              <div className="mt-3">
                <DownloadPdfButton sessionId={entry.id} hasPdf={entry.hasPdf} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
