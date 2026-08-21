"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { type Editor, useEditorState } from "@tiptap/react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FONT_SIZES, type LessonAlign } from "./extensions";

/**
 * Barra de ferramentas do canvas — a "faixa" do editor. Fica colada no topo
 * da folha e é a única superfície densa da tela: tudo que um professor faria
 * num editor de texto está a um clique, sem menu escondido.
 */

const TEXT_COLORS = [
  { value: "#0b1a33", label: "Tinta" },
  { value: "#0f2c5c", label: "Marinho" },
  { value: "#1c4c95", label: "Azul" },
  { value: "#0f7a5a", label: "Verde" },
  { value: "#b42318", label: "Vermelho" },
  { value: "#8a6d1b", label: "Dourado" },
  { value: "#5a6b85", label: "Cinza" },
];

const HIGHLIGHTS = [
  { value: "#fdf3c9", label: "Amarelo" },
  { value: "#d8f0e6", label: "Verde" },
  { value: "#dbe5f5", label: "Azul" },
  { value: "#fbdcd8", label: "Rosa" },
  { value: "#ece4fb", label: "Lilás" },
];

const BLOCK_OPTIONS = [
  { value: "paragraph", label: "Texto" },
  { value: "h1", label: "Título" },
  { value: "h2", label: "Seção" },
  { value: "h3", label: "Subseção" },
  { value: "blockquote", label: "Citação" },
  { value: "codeBlock", label: "Código" },
];

const ALIGNS: { value: LessonAlign; label: string }[] = [
  { value: "left", label: "Alinhar à esquerda" },
  { value: "center", label: "Centralizar" },
  { value: "right", label: "Alinhar à direita" },
  { value: "justify", label: "Justificar" },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ICONS = {
  undo: (
    <Icon>
      <path d="M4 9h11a5 5 0 0 1 0 10h-6" />
      <path d="M4 9l4-4M4 9l4 4" />
    </Icon>
  ),
  redo: (
    <Icon>
      <path d="M20 9H9a5 5 0 0 0 0 10h6" />
      <path d="M20 9l-4-4M20 9l-4 4" />
    </Icon>
  ),
  bullet: (
    <Icon>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" />
    </Icon>
  ),
  ordered: (
    <Icon>
      <path d="M9 6h11M9 12h11M9 18h11M4 5h1v4M3.6 18.6h2M3.6 15.4h1.8l-1.8 2.2" />
    </Icon>
  ),
  task: (
    <Icon>
      <rect x="3" y="4.5" width="6" height="6" rx="1.5" />
      <path d="M4.6 7.6l1.2 1.2 2-2.4M12 7.5h9M12 16.5h9" />
      <rect x="3" y="13.5" width="6" height="6" rx="1.5" />
    </Icon>
  ),
  image: (
    <Icon>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M4 17l4.5-4.5L12 16l3-2.5 5 4" />
    </Icon>
  ),
  table: (
    <Icon>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 10h18M3 15h18M9 4.5v15M15 4.5v15" />
    </Icon>
  ),
  link: (
    <Icon>
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </Icon>
  ),
  rule: (
    <Icon>
      <path d="M3 12h18M6 7h12M6 17h12" />
    </Icon>
  ),
  clear: (
    <Icon>
      <path d="M7 7l10 10M17 7L7 17" />
      <path d="M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 0 0-17 0Z" />
    </Icon>
  ),
} as const;

const ALIGN_ICON: Record<LessonAlign, ReactNode> = {
  left: (
    <Icon>
      <path d="M4 6h16M4 10.5h10M4 15h16M4 19.5h10" />
    </Icon>
  ),
  center: (
    <Icon>
      <path d="M4 6h16M7 10.5h10M4 15h16M7 19.5h10" />
    </Icon>
  ),
  right: (
    <Icon>
      <path d="M4 6h16M10 10.5h10M4 15h16M10 19.5h10" />
    </Icon>
  ),
  justify: (
    <Icon>
      <path d="M4 6h16M4 10.5h16M4 15h16M4 19.5h16" />
    </Icon>
  ),
};

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
  wide,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "relative grid h-9 place-items-center rounded-lg text-sm font-semibold transition-colors",
        wide ? "px-2.5" : "w-9",
        active
          ? "bg-navy-900 text-white shadow-[0_6px_16px_-8px_rgba(10,31,68,0.9)]"
          : "text-admin-foreground/70 hover:bg-admin-muted hover:text-admin-foreground",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-6 w-px shrink-0 bg-admin-border" aria-hidden />;
}

/** Popover leve: fecha no clique fora e no Escape, ancorado ao gatilho. */
function Popover({
  label,
  trigger,
  children,
}: {
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors",
          open
            ? "bg-admin-muted text-admin-foreground"
            : "text-admin-foreground/70 hover:bg-admin-muted hover:text-admin-foreground",
        )}
      >
        {trigger}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
            className="absolute left-0 top-11 z-30 min-w-[188px] rounded-xl border border-admin-border bg-white p-2 shadow-[var(--shadow-card-hover)]"
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function blockValue(editor: Editor): string {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("blockquote")) return "blockquote";
  if (editor.isActive("codeBlock")) return "codeBlock";
  return "paragraph";
}

function applyBlock(editor: Editor, value: string) {
  const chain = editor.chain().focus();
  if (value === "h1") return chain.setNode("heading", { level: 1 }).run();
  if (value === "h2") return chain.setNode("heading", { level: 2 }).run();
  if (value === "h3") return chain.setNode("heading", { level: 3 }).run();
  if (value === "blockquote") return chain.setParagraph().toggleBlockquote().run();
  if (value === "codeBlock") return chain.toggleCodeBlock().run();
  return chain.setParagraph().run();
}

export interface RibbonProps {
  editor: Editor;
  onPickImage: () => void;
}

export function Ribbon({ editor, onPickImage }: RibbonProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      underline: instance.isActive("underline"),
      strike: instance.isActive("strike"),
      code: instance.isActive("code"),
      link: instance.isActive("link"),
      bulletList: instance.isActive("bulletList"),
      orderedList: instance.isActive("orderedList"),
      taskList: instance.isActive("taskList"),
      block: blockValue(instance),
      align: (instance.getAttributes("paragraph").textAlign ??
        instance.getAttributes("heading").textAlign ??
        "left") as LessonAlign,
      color: (instance.getAttributes("textStyle").color as string | null) ?? null,
      fontSize: (instance.getAttributes("textStyle").fontSize as string | null) ?? null,
      highlight: (instance.getAttributes("highlight").color as string | null) ?? null,
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  });

  const currentSize = state.fontSize ? state.fontSize.replace("px", "") : "16";

  return (
    <div
      role="toolbar"
      aria-label="Ferramentas de edição"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 rounded-t-2xl border-b border-admin-border bg-white/92 px-2.5 py-2 backdrop-blur-md"
    >
      <ToolButton
        label="Desfazer"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        {ICONS.undo}
      </ToolButton>
      <ToolButton
        label="Refazer"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        {ICONS.redo}
      </ToolButton>

      <Divider />

      <Popover
        label="Estilo do parágrafo"
        trigger={
          <>
            <span className="w-[74px] truncate text-left text-[13px] font-medium">
              {BLOCK_OPTIONS.find((option) => option.value === state.block)?.label}
            </span>
            <span aria-hidden className="text-[10px] opacity-60">
              ▼
            </span>
          </>
        }
      >
        {(close) => (
          <div className="flex flex-col">
            {BLOCK_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  applyBlock(editor, option.value);
                  close();
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-admin-muted",
                  state.block === option.value &&
                    "bg-navy-50 font-semibold text-navy-900",
                  option.value === "h1" && "text-lg font-bold",
                  option.value === "h2" && "text-base font-semibold",
                  option.value === "codeBlock" && "font-mono text-[13px]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </Popover>

      <Popover
        label="Corpo da fonte"
        trigger={
          <>
            <span className="w-6 text-[13px] font-medium tabular">{currentSize}</span>
            <span aria-hidden className="text-[10px] opacity-60">
              ▼
            </span>
          </>
        }
      >
        {(close) => (
          <div className="grid grid-cols-4 gap-1">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  editor.chain().focus().setFontSize(size).run();
                  close();
                }}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-sm tabular transition-colors hover:bg-admin-muted",
                  currentSize === size && "bg-navy-900 text-white",
                )}
              >
                {size}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().setFontSize(null).run();
                close();
              }}
              className="col-span-4 rounded-lg px-2 py-1.5 text-xs text-admin-foreground/70 transition-colors hover:bg-admin-muted"
            >
              Tamanho padrão
            </button>
          </div>
        )}
      </Popover>

      <Divider />

      <ToolButton
        label="Negrito"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-serif text-[15px] font-bold">B</span>
      </ToolButton>
      <ToolButton
        label="Itálico"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="font-serif text-[15px] italic">I</span>
      </ToolButton>
      <ToolButton
        label="Sublinhado"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="font-serif text-[15px] underline">U</span>
      </ToolButton>
      <ToolButton
        label="Tachado"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="font-serif text-[15px] line-through">S</span>
      </ToolButton>
      <ToolButton
        label="Código"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <span className="font-mono text-[13px]">{"</>"}</span>
      </ToolButton>

      <Popover
        label="Cor do texto"
        trigger={
          <span className="flex flex-col items-center gap-0.5">
            <span className="text-[13px] font-semibold leading-none">A</span>
            <span
              className="h-1 w-4 rounded-full"
              style={{ background: state.color ?? "#0b1a33" }}
            />
          </span>
        }
      >
        {(close) => (
          <div className="grid grid-cols-4 gap-1.5">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                aria-label={color.label}
                onClick={() => {
                  editor.chain().focus().setTextColor(color.value).run();
                  close();
                }}
                className={cn(
                  "h-7 w-7 rounded-full border border-black/10 transition-transform hover:scale-110",
                  state.color === color.value && "ring-2 ring-navy-900 ring-offset-2",
                )}
                style={{ background: color.value }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().setTextColor(null).run();
                close();
              }}
              className="col-span-4 rounded-lg px-2 py-1.5 text-xs text-admin-foreground/70 transition-colors hover:bg-admin-muted"
            >
              Cor padrão
            </button>
          </div>
        )}
      </Popover>

      <Popover
        label="Realce"
        trigger={
          <span className="flex flex-col items-center gap-0.5">
            <span className="text-[13px] font-semibold leading-none">✱</span>
            <span
              className="h-1 w-4 rounded-full"
              style={{ background: state.highlight ?? "#fdf3c9" }}
            />
          </span>
        }
      >
        {(close) => (
          <div className="grid grid-cols-5 gap-1.5">
            {HIGHLIGHTS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                aria-label={color.label}
                onClick={() => {
                  editor.chain().focus().setHighlight({ color: color.value }).run();
                  close();
                }}
                className={cn(
                  "h-7 w-7 rounded-full border border-black/10 transition-transform hover:scale-110",
                  state.highlight === color.value &&
                    "ring-2 ring-navy-900 ring-offset-2",
                )}
                style={{ background: color.value }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                close();
              }}
              className="col-span-5 rounded-lg px-2 py-1.5 text-xs text-admin-foreground/70 transition-colors hover:bg-admin-muted"
            >
              Sem realce
            </button>
          </div>
        )}
      </Popover>

      <Divider />

      {ALIGNS.map((align) => (
        <ToolButton
          key={align.value}
          label={align.label}
          active={state.align === align.value}
          onClick={() => editor.chain().focus().setTextAlign(align.value).run()}
        >
          {ALIGN_ICON[align.value]}
        </ToolButton>
      ))}

      <Divider />

      <ToolButton
        label="Lista com marcadores"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        {ICONS.bullet}
      </ToolButton>
      <ToolButton
        label="Lista numerada"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        {ICONS.ordered}
      </ToolButton>
      <ToolButton
        label="Lista de tarefas"
        active={state.taskList}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        {ICONS.task}
      </ToolButton>

      <Divider />

      <ToolButton label="Inserir imagem" onClick={onPickImage}>
        {ICONS.image}
      </ToolButton>
      <ToolButton
        label="Inserir tabela"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        {ICONS.table}
      </ToolButton>
      <ToolButton
        label="Link"
        active={state.link}
        onClick={() => {
          const previous = (editor.getAttributes("link").href as string) ?? "";
          const url = window.prompt("Endereço do link:", previous);
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        {ICONS.link}
      </ToolButton>
      <ToolButton
        label="Linha divisória"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        {ICONS.rule}
      </ToolButton>

      <Divider />

      <ToolButton
        label="Limpar formatação"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        {ICONS.clear}
      </ToolButton>
    </div>
  );
}
