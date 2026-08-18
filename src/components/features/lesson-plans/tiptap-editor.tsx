"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { EditorToolbar } from "@/components/features/lesson-plans/editor-toolbar";

interface TiptapEditorProps {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  editable?: boolean;
}

/**
 * Componente compartilhado por planos de aula (Fase 5) e, na Fase 6, pela
 * sala de aula ao vivo — mesma stack de extensões, o autosave/versão fica
 * na camada de cima (cada tela decide sua própria estratégia de salvar).
 */
export function TiptapEditor({ content, onChange, editable = true }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Comece a escrever o conteúdo da aula…" }),
      CharacterCount,
    ],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[400px] rounded-b-md border border-t-0 border-border bg-background px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  if (!editor) return null;

  return (
    <div>
      {editable && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
      {editable && (
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {editor.storage.characterCount.words()} palavras
        </p>
      )}
    </div>
  );
}
