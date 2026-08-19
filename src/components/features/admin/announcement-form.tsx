"use client";

import { useActionState, useState } from "react";
import { createAnnouncementAction } from "@/actions/admin/announcements";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FormBanner } from "@/components/ui/form-message";
import type { GroupListItem } from "@/repositories/groups";

export function AnnouncementForm({ groups }: { groups: GroupListItem[] }) {
  const [state, formAction, isPending] = useActionState(createAnnouncementAction, null);
  const [scope, setScope] = useState<"school" | "group">("school");

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      {state && !state.success && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}
      {state?.success && <FormBanner tone="success">Comunicado enviado.</FormBanner>}

      <div className="space-y-1.5">
        <Label htmlFor="scope">Enviar para</Label>
        <Select
          id="scope"
          name="scope"
          tone="admin"
          value={scope}
          onChange={(next) => setScope(next as "school" | "group")}
        >
          <option value="school">Toda a escola</option>
          <option value="group">Uma turma</option>
        </Select>
      </div>

      {scope === "group" && (
        <div className="space-y-1.5">
          <Label htmlFor="groupId">Turma</Label>
          <Select id="groupId" name="groupId" tone="admin">
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Mensagem</Label>
        <textarea
          id="body"
          name="body"
          rows={4}
          required
          className="w-full rounded-md border border-admin-border bg-admin-background px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-admin-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Enviando…" : "Enviar comunicado"}
      </button>
    </form>
  );
}
