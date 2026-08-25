"use client";

import { useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/react";
import { updateLessonPlanContentAction } from "@/actions/teacher/lesson-plans";
import { TiptapEditor } from "@/components/features/lesson-plans/tiptap-editor-dynamic";
import { FormBanner } from "@/components/ui/form-message";
import type { Json } from "@/types/database.types";
import { LogoLoader } from "@/components/ui/logo-loader";

export function LessonPlanContentEditor({
  planId,
  initialContent,
  editable,
}: {
  planId: string;
  initialContent: Json;
  editable: boolean;
}) {
  const [content, setContent] = useState<JSONContent>(
    (initialContent as JSONContent) ?? { type: "doc" },
  );
  const [dirty, setDirty] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function handleSave() {
    setError(null);
    startSaving(async () => {
      const formData = new FormData();
      formData.set("content", JSON.stringify(content));
      const result = await updateLessonPlanContentAction(planId, formData);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setDirty(false);
      setSavedAt(new Date());
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-3">
          <FormBanner tone="error">{error}</FormBanner>
        </div>
      )}
      <TiptapEditor
        content={content}
        editable={editable}
        onChange={(next) => {
          setContent(next);
          setDirty(true);
        }}
      />
      {editable && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !dirty}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <LogoLoader size={16} label={null} />
                Salvando…
              </span>
            ) : (
              "Salvar conteúdo"
            )}
          </button>
          <span className="text-sm text-muted-foreground">
            {dirty
              ? "Alterações não salvas"
              : savedAt
                ? `Salvo às ${savedAt.toLocaleTimeString("pt-BR")}`
                : ""}
          </span>
        </div>
      )}
    </div>
  );
}
