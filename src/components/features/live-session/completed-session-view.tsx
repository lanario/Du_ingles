import { TiptapEditor } from "@/components/features/lesson-plans/tiptap-editor-dynamic";
import { DownloadPdfButton } from "@/components/features/library/download-pdf-button";
import type { LiveSessionDetail } from "@/repositories/live-session";
import type { JSONContent } from "@tiptap/react";

export function CompletedSessionView({ session }: { session: LiveSessionDetail }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {session.title} · {session.groupName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Aula encerrada em{" "}
            {session.endedAt && new Date(session.endedAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <DownloadPdfButton sessionId={session.id} hasPdf={!!session.pdfPath} />
      </div>
      <TiptapEditor
        content={session.content as JSONContent}
        onChange={() => {}}
        editable={false}
      />
    </div>
  );
}
