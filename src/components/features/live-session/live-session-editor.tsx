"use client";

import { useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import {
  saveContentAction,
  saveVersionAction,
  acquireLockAction,
  endSessionAction,
} from "@/actions/teacher/live-session";
import { TiptapEditor } from "@/components/features/lesson-plans/tiptap-editor-dynamic";
import { AutosaveIndicator } from "@/components/features/live-session/autosave-indicator";
import { useAutosave } from "@/hooks/use-autosave";
import type { LiveSessionDetail } from "@/repositories/live-session";

const VERSION_SNAPSHOT_MS = 5 * 60 * 1000;

interface SavePayload {
  content: JSONContent;
  teacherNotes: string;
  homework: string;
}

export function LiveSessionEditor({ session }: { session: LiveSessionDetail }) {
  const [content, setContent] = useState<JSONContent>(
    (session.content as JSONContent) ?? { type: "doc" },
  );
  const [teacherNotes, setTeacherNotes] = useState(session.teacherNotes ?? "");
  const [homework, setHomework] = useState(session.homework ?? "");
  const [projection, setProjection] = useState(false);
  const [lockWarning, setLockWarning] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const clientId = useRef(crypto.randomUUID());
  const latestRef = useRef<SavePayload>({ content, teacherNotes, homework });
  latestRef.current = { content, teacherNotes, homework };

  const { status, lastSavedAt, schedule, flush } = useAutosave<SavePayload>(
    async (value) => {
      return saveContentAction(
        session.id,
        value.content,
        value.teacherNotes,
        value.homework,
      ).then((r) => r.success);
    },
  );

  useEffect(() => {
    acquireLockAction(session.id, clientId.current).then((r) => {
      if (r.heldBySomeoneElse) setLockWarning(true);
    });
    const heartbeat = setInterval(() => {
      acquireLockAction(session.id, clientId.current);
    }, 30_000);
    return () => clearInterval(heartbeat);
  }, [session.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      saveVersionAction(session.id, latestRef.current.content);
    }, VERSION_SNAPSHOT_MS);
    return () => clearInterval(interval);
  }, [session.id]);

  function update(patch: Partial<SavePayload>) {
    const next = { ...latestRef.current, ...patch };
    if (patch.content) setContent(patch.content);
    if (patch.teacherNotes !== undefined) setTeacherNotes(patch.teacherNotes);
    if (patch.homework !== undefined) setHomework(patch.homework);
    schedule(next);
  }

  async function handleEnd() {
    if (!confirm("Encerrar a aula? O PDF será gerado e disponibilizado para os alunos."))
      return;
    await flush();
    setIsEnding(true);
    await endSessionAction(session.id);
  }

  return (
    <div
      className={projection ? "fixed inset-0 z-50 overflow-y-auto bg-background p-8" : ""}
    >
      {lockWarning && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Esta aula está sendo editada em outra aba. Suas alterações aqui podem ser
          sobrescritas.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className={projection ? "text-2xl font-semibold" : "text-xl font-semibold"}>
          {session.title} · {session.groupName}
        </h1>
        <div className="flex items-center gap-3">
          <AutosaveIndicator status={status} lastSavedAt={lastSavedAt} />
          <button
            type="button"
            onClick={() => setProjection((p) => !p)}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {projection ? "Sair da projeção" : "Modo projeção"}
          </button>
          <button
            type="button"
            onClick={handleEnd}
            disabled={isEnding}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isEnding ? "Encerrando…" : "Encerrar aula"}
          </button>
        </div>
      </div>

      <div className={projection ? "mx-auto max-w-4xl text-lg" : ""}>
        <TiptapEditor content={content} onChange={(next) => update({ content: next })} />
      </div>

      {!projection && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="homework" className="text-sm font-medium">
              Tarefa de casa (visível ao aluno)
            </label>
            <textarea
              id="homework"
              rows={3}
              value={homework}
              onChange={(e) => update({ homework: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="teacherNotes" className="text-sm font-medium">
              Notas privadas (só você vê)
            </label>
            <textarea
              id="teacherNotes"
              rows={3}
              value={teacherNotes}
              onChange={(e) => update({ teacherNotes: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
