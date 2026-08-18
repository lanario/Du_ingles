import type { Metadata } from "next";
import Link from "next/link";
import { listGroups } from "@/repositories/groups";

export const metadata: Metadata = { title: "Turmas" };

export default async function TurmasPage() {
  const groups = await listGroups();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Turmas</h1>
        <Link
          href="/admin/turmas/novo"
          className="rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-admin-accent-foreground hover:opacity-90"
        >
          Nova turma
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-admin-border p-10 text-center">
          <p className="text-admin-foreground/70">Nenhuma turma criada ainda.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-admin-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border text-left text-admin-foreground/60">
                <th className="px-4 py-3 font-medium">Turma</th>
                <th className="px-4 py-3 font-medium">Professor</th>
                <th className="px-4 py-3 font-medium">Curso</th>
                <th className="px-4 py-3 font-medium">Nível</th>
                <th className="px-4 py-3 font-medium">Alunos</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-b border-admin-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/turmas/${group.id}`} className="hover:underline">
                      {group.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-admin-foreground/70">
                    {group.teacherName}
                  </td>
                  <td className="px-4 py-3 text-admin-foreground/70">
                    {group.courseName ?? "—"}
                  </td>
                  <td className="px-4 py-3">{group.level}</td>
                  <td className="px-4 py-3 text-admin-foreground/70">
                    {group.enrolledCount}/{group.maxStudents}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
