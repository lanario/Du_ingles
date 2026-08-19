"use client";

import { useActionState } from "react";
import { createAssignmentAction } from "@/actions/teacher/assignments";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import type { MyGroupItem } from "@/repositories/groups";

export function CreateAssignmentForm({
  groups,
  defaultGroupId,
}: {
  groups: MyGroupItem[];
  defaultGroupId?: string;
}) {
  const [state, formAction, isPending] = useActionState(createAssignmentAction, null);

  return (
    <form action={formAction} className="max-w-lg space-y-4" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="groupId">Turma</Label>
        <Select id="groupId" name="groupId" defaultValue={defaultGroupId} required>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} · {g.level}
            </option>
          ))}
        </Select>
        <FieldError
          messages={state && !state.success ? state.error.fields?.["groupId"] : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["title"] : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="dueAt">Prazo (opcional)</Label>
          <DateField id="dueAt" name="dueAt" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxScore">Nota máxima</Label>
          <Input
            id="maxScore"
            name="maxScore"
            type="number"
            min={0}
            max={1000}
            step="0.1"
            defaultValue={10}
          />
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Criando…" : "Criar tarefa"}
      </Button>
    </form>
  );
}
