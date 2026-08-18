"use client";

export function LibraryFilter({
  groups,
  selected,
}: {
  groups: { id: string; name: string }[];
  selected?: string;
}) {
  return (
    <form className="mt-6" action="/biblioteca">
      <select
        name="turma"
        defaultValue={selected ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-10 rounded-md border border-border bg-background px-3 text-sm"
      >
        <option value="">Todas as turmas</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </form>
  );
}
