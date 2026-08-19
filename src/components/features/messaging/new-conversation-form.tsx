"use client";

import { useActionState } from "react";
import { startConversationAction } from "@/actions/messaging/conversations";
import { Select } from "@/components/ui/select";
import { FormBanner } from "@/components/ui/form-message";
import type { Contact } from "@/repositories/conversations";

export function NewConversationForm({ contacts }: { contacts: Contact[] }) {
  const [state, formAction, isPending] = useActionState(startConversationAction, null);

  if (contacts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Nenhum contato disponível ainda.</p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      {state && !state.success && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}
      <Select name="contactId" defaultValue="" placeholder="Nova conversa com…" className="h-9">
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.fullName}
          </option>
        ))}
      </Select>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md border border-border py-1.5 text-sm hover:bg-muted disabled:opacity-50"
      >
        {isPending ? "Abrindo…" : "Iniciar"}
      </button>
    </form>
  );
}
