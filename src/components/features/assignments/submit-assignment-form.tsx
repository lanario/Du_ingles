"use client";

import { useActionState } from "react";
import { submitAssignmentAction } from "@/actions/student/assignments";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";

export function SubmitAssignmentForm({
  assignmentId,
  initialContent,
}: {
  assignmentId: string;
  initialContent?: string;
}) {
  const action = submitAssignmentAction.bind(null, assignmentId);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}
      {state?.success && <FormBanner tone="success">Resposta enviada!</FormBanner>}

      <div className="space-y-1.5">
        <Label htmlFor="content">Sua resposta</Label>
        <textarea
          id="content"
          name="content"
          rows={8}
          defaultValue={initialContent}
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["content"] : undefined}
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <LogoLoader size={16} label={null} />
            Enviando…
          </span>
        ) : (
          "Enviar resposta"
        )}
      </Button>
    </form>
  );
}
