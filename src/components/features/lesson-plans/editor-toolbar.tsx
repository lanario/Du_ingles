"use client";

import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

function ToolbarButton({
  onClick,
  active,
  children,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center rounded px-2 text-sm font-medium",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  return (
    <div
      role="toolbar"
      aria-label="Formatação"
      className="flex flex-wrap items-center gap-1 rounded-t-md border border-border bg-muted/50 p-1.5"
    >
      <ToolbarButton
        label="Negrito"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label="Itálico"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </ToolbarButton>
      <ToolbarButton
        label="Sublinhado"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        U
      </ToolbarButton>
      <ToolbarButton
        label="Tachado"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        S
      </ToolbarButton>
      <ToolbarButton
        label="Destacar"
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        ✱
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <ToolbarButton
        label="Título 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Título 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <ToolbarButton
        label="Lista"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •—
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        label="Lista de tarefas"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        ☑
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <ToolbarButton
        label="Tabela"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        ▦
      </ToolbarButton>
      <ToolbarButton
        label="Linha horizontal"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        —
      </ToolbarButton>
      <ToolbarButton
        label="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const url = window.prompt("URL do link:");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        🔗
      </ToolbarButton>
    </div>
  );
}
