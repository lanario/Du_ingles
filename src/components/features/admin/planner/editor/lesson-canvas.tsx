"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LessonImage,
  LessonTextAlign,
  LessonTextBox,
  LessonTextStyle,
} from "./extensions";
import { insertImageFiles, isSupportedImage } from "./image-upload";
import { Ribbon } from "./ribbon";
import { LoadingVeil } from "@/components/ui/logo-loader";

/**
 * A folha. Um documento tipo processador de texto: régua fixa no topo,
 * papel branco com sombra no meio do canvas e imagens que entram por
 * Ctrl+V — coladas direto da tela, como o cliente pediu — já redimensionadas
 * e enviadas para o Storage em segundo plano.
 */

export interface LessonCanvasProps {
  content: JSONContent;
  onChange?: (content: JSONContent) => void;
  editable?: boolean;
  /** Pasta das imagens no Storage: `plano-<id>` ou `aula-<id>`. */
  scope: string;
  placeholder?: string;
  /** Modo apresentação: tipografia maior, sem cromo em volta da folha. */
  presenting?: boolean;
  /**
   * Régua de ferramentas. Por padrão ela aparece quando a folha é editável e
   * não está sendo apresentada — na apresentação o professor ainda escreve,
   * mas com a tela limpa. Passe `true` para trazê-la de volta ali.
   */
  showToolbar?: boolean;
  /**
   * Folha ocupando toda a altura do contêiner (ateliê e sala de aula) — quem
   * limita a altura é a tela que usa o canvas. Fora daí a folha cresce com o
   * conteúdo, para caber dentro de outras seções.
   */
  fill?: boolean;
  onReady?: (editor: Editor) => void;
}

export function LessonCanvas({
  content,
  onChange,
  editable = true,
  scope,
  placeholder = "Escreva a aula… cole imagens direto aqui (Ctrl+V).",
  presenting = false,
  showToolbar,
  fill = false,
  onReady,
}: LessonCanvasProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // A configuração do editor é criada uma única vez: chamar o handler por um
  // ref é o que garante que a colagem use a instância atual do editor, e não
  // a closure do primeiro render (quando `editor` ainda é null).
  const handleFilesRef = useRef<((files: File[]) => Promise<void>) | null>(null);

  // Último documento que esta instância viu — escrito por ela (onUpdate) ou
  // recebido de fora (efeito de sincronia). É o que evita o vaivém entre duas
  // folhas montadas ao mesmo tempo.
  const lastSyncedRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      LessonTextStyle,
      LessonTextAlign,
      LessonImage,
      LessonTextBox,
    ],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "lesson-sheet focus:outline-none",
          presenting && "lesson-sheet-presenting",
        ),
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0 || !files.some(isSupportedImage)) return false;
        event.preventDefault();
        void handleFilesRef.current?.(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const dropEvent = event as DragEvent;
        const files = Array.from(dropEvent.dataTransfer?.files ?? []);
        if (files.length === 0 || !files.some(isSupportedImage)) return false;
        dropEvent.preventDefault();
        setDragActive(false);
        void handleFilesRef.current?.(files);
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => {
      const json = instance.getJSON();
      lastSyncedRef.current = JSON.stringify(json);
      onChange?.(json);
    },
  });

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!editor || !editor.isEditable) return;
      try {
        const result = await insertImageFiles(editor, files, scope);
        setNotice(result.errors[0] ?? null);
      } catch (error) {
        // Rede final: nada aqui pode escapar sem virar mensagem na tela —
        // uma exceção silenciosa deixaria a imagem presa em "enviando".
        console.error("[canvas] falha ao inserir imagem", error);
        setNotice("Não consegui inserir a imagem. Tente novamente.");
      }
    },
    [editor, scope],
  );

  useEffect(() => {
    handleFilesRef.current = handleFiles;
  }, [handleFiles]);

  useEffect(() => {
    if (editor) onReady?.(editor);
  }, [editor, onReady]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  /**
   * Duas folhas podem estar montadas ao mesmo tempo — a do ateliê e a da
   * apresentação por cima dela. O que se escreve numa precisa chegar na outra,
   * senão fechar a apresentação descarta o que acabou de ser digitado. O
   * `setContent` só roda quando o documento que vem de fora é realmente
   * diferente do que esta instância tem, e sem emitir update, para as duas não
   * ficarem se escrevendo em laço.
   */
  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(content);
    if (incoming === lastSyncedRef.current) return;
    lastSyncedRef.current = incoming;
    if (incoming === JSON.stringify(editor.getJSON())) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!editor) {
    return (
      <div className="relative min-h-[520px] rounded-2xl border border-admin-border bg-admin-surface">
        <LoadingVeil label="Abrindo o editor…" size={72} className="rounded-2xl" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "lesson-card relative overflow-hidden rounded-2xl border border-admin-border bg-white shadow-[var(--shadow-card)] transition-shadow",
        fill && !presenting && "flex h-full min-h-0 flex-col",
        dragActive && "ring-2 ring-gold-500 ring-offset-2 ring-offset-admin-background",
      )}
      onDragOver={(event) => {
        if (!editable) return;
        if (Array.from(event.dataTransfer.types).includes("Files")) {
          event.preventDefault();
          setDragActive(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragActive(false);
      }}
      onDrop={() => setDragActive(false)}
    >
      {editable && (showToolbar ?? !presenting) && (
        <Ribbon editor={editor} onPickImage={() => fileInputRef.current?.click()} />
      )}

      {editable && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: instance, from, to }) =>
            from !== to && !instance.isActive("image")
          }
          className="flex items-center gap-0.5 rounded-full border border-admin-border bg-white/95 px-1.5 py-1 shadow-[var(--shadow-card-hover)] backdrop-blur"
        >
          {[
            {
              label: "Negrito",
              glyph: "B",
              className: "font-bold",
              active: editor.isActive("bold"),
              run: () => editor.chain().focus().toggleBold().run(),
            },
            {
              label: "Itálico",
              glyph: "I",
              className: "italic",
              active: editor.isActive("italic"),
              run: () => editor.chain().focus().toggleItalic().run(),
            },
            {
              label: "Sublinhado",
              glyph: "U",
              className: "underline",
              active: editor.isActive("underline"),
              run: () => editor.chain().focus().toggleUnderline().run(),
            },
            {
              label: "Realçar",
              glyph: "✱",
              className: "",
              active: editor.isActive("highlight"),
              run: () =>
                editor.chain().focus().toggleHighlight({ color: "#fdf3c9" }).run(),
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              title={item.label}
              aria-label={item.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={item.run}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full font-serif text-sm transition-colors",
                item.className,
                item.active
                  ? "bg-navy-900 text-white"
                  : "text-admin-foreground/70 hover:bg-admin-muted",
              )}
            >
              {item.glyph}
            </button>
          ))}
        </BubbleMenu>
      )}

      <div
        className={cn(
          "lesson-paper overflow-y-auto",
          fill && !presenting && "lesson-paper-fill",
          presenting ? "px-6 py-10 sm:px-16" : "px-4 py-8 sm:px-8 xl:px-12",
        )}
      >
        <EditorContent editor={editor} />
      </div>

      <AnimatePresence>
        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-gold-50/70 backdrop-blur-[2px]"
          >
            <span className="rounded-full border border-gold-300 bg-white px-4 py-2 text-sm font-medium text-navy-900 shadow">
              Solte a imagem para inserir na aula
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-medium text-red-700 shadow"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      {editable && !presenting && (
        <div className="flex items-center justify-between border-t border-admin-border/70 px-5 py-2 text-[11px] text-admin-foreground/50">
          <span>
            Cole imagens com Ctrl+V · arraste para mover, os cantos para redimensionar
            · a imagem solta e a caixa de texto flutuam sobre a folha, sem ocupar
            linha do texto
          </span>
          <span className="tabular">
            {editor.storage.characterCount.words()} palavras ·{" "}
            {editor.storage.characterCount.characters()} caracteres
          </span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void handleFiles(files);
        }}
      />
    </div>
  );
}
