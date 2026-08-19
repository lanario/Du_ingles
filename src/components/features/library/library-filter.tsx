"use client";

import { useRef } from "react";
import { Select } from "@/components/ui/select";

export function LibraryFilter({
  groups,
  selected,
}: {
  groups: { id: string; name: string }[];
  selected?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} className="mt-5" action="/biblioteca">
      <Select
        name="turma"
        defaultValue={selected ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-auto min-w-56"
      >
        <option value="">Todas as turmas</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>
    </form>
  );
}
