import type { Metadata } from "next";
import { listLibraryEntries, listMyGroupsForFilter } from "@/repositories/library";
import { LibraryView } from "@/components/features/library/library-view";

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

  return <LibraryView entries={entries} groups={groups} selectedGroupId={turma} />;
}
