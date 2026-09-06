"use client";

/**
 * Pastas do ateliê — a estante lateral e os dois diálogos que a mantêm.
 *
 * A estante mistura duas naturezas de propósito, e é isso que a separação
 * visual comunica:
 *
 * - **Biblioteca** ("Todas", "Compartilhadas", "Privadas") são *filtros*
 *   calculados a partir de `isShared`. Não guardam nada: uma aula
 *   compartilhada continua aparecendo ali mesmo depois de arquivada.
 * - **Minhas pastas** são *lugares* de verdade (`lesson_plans.folder_id`),
 *   criados e nomeados por quem usa. Cada um enxerga só a própria estante.
 *
 * É essa diferença que decide o que aceita uma aula arrastada: pasta e "sem
 * pasta" recebem (são lugares, e soltar ali escreve `folder_id`); os filtros
 * da biblioteca não recebem — não há o que gravar em "Compartilhadas".
 */

import { useActionState, useEffect, useState } from "react";
import {
  createPlannerFolderAction,
  updatePlannerFolderAction,
} from "@/actions/admin/lesson-planner";
import { ActionMenu } from "@/components/ui/action-menu";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";
import {
  CheckIcon,
  FolderIcon,
  FolderPlusIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { PLANNER_FOLDER_COLORS, type PlannerFolderColor } from "@/schemas/lesson-planner";
import type { AtelieKey } from "./planner-utils";
import type { PlannerFolder } from "@/repositories/lesson-planner";

/** Etiqueta de cor: o ponto da lista e a amostra do seletor. */
const COLOR_DOT: Record<PlannerFolderColor, string> = {
  gold: "bg-gold-500",
  navy: "bg-navy-700",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

const COLOR_LABEL: Record<PlannerFolderColor, string> = {
  gold: "Dourado",
  navy: "Azul",
  emerald: "Verde",
  violet: "Violeta",
  rose: "Rosa",
  slate: "Cinza",
};

export interface AtelieCounts {
  todas: number;
  compartilhadas: number;
  privadas: number;
  semPasta: number;
  /** Por id de pasta. */
  byFolder: Record<string, number>;
}

export function FolderRail({
  folders,
  counts,
  value,
  onChange,
  onCreate,
  onEdit,
  onDelete,
  dragging = false,
  onDropPlan,
}: {
  folders: PlannerFolder[];
  counts: AtelieCounts;
  value: AtelieKey;
  onChange: (key: AtelieKey) => void;
  onCreate: () => void;
  onEdit: (folder: PlannerFolder) => void;
  onDelete: (folder: PlannerFolder) => void;
  /** Uma aula está sendo arrastada agora — os lugares se acendem. */
  dragging?: boolean;
  /** Aula solta num lugar. `null` é "sem pasta": limpa o `folder_id`. */
  onDropPlan?: (folderId: string | null) => void;
}) {
  /** Só vira alvo se houver para onde soltar e alguém arrastando. */
  const dropOn = (folderId: string | null) =>
    dragging && onDropPlan ? () => onDropPlan(folderId) : undefined;

  return (
    <nav aria-label="Pastas do ateliê" className="lg:sticky lg:top-4">
      <div
        className={cn(
          "flex gap-1.5 overflow-x-auto pb-1",
          "lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-2xl lg:border lg:border-admin-border lg:bg-admin-surface lg:p-2",
        )}
      >
        <RailHeading>Biblioteca</RailHeading>

        <RailItem
          label="Todas as aulas"
          count={counts.todas}
          active={value === "todas"}
          onSelect={() => onChange("todas")}
        />
        <RailItem
          label="Compartilhadas"
          hint="visíveis para toda a escola"
          count={counts.compartilhadas}
          active={value === "compartilhadas"}
          onSelect={() => onChange("compartilhadas")}
        />
        <RailItem
          label="Privadas"
          hint="ainda não compartilhadas"
          count={counts.privadas}
          active={value === "privadas"}
          onSelect={() => onChange("privadas")}
        />

        <RailHeading>Minhas pastas</RailHeading>

        {folders.map((folder) => (
          <RailItem
            key={folder.id}
            label={folder.name}
            count={counts.byFolder[folder.id] ?? 0}
            dot={COLOR_DOT[folder.color] ?? COLOR_DOT.gold}
            active={value === folder.id}
            onSelect={() => onChange(folder.id)}
            onDropPlan={dropOn(folder.id)}
            menu={
              <ActionMenu
                label={"Ações da pasta " + folder.name}
                items={[
                  {
                    label: "Renomear",
                    icon: PencilIcon,
                    onSelect: () => onEdit(folder),
                  },
                  {
                    label: "Excluir pasta",
                    icon: TrashIcon,
                    tone: "danger",
                    separated: true,
                    onSelect: () => onDelete(folder),
                  },
                ]}
              />
            }
          />
        ))}

        {folders.length > 0 && (
          <RailItem
            label="Sem pasta"
            count={counts.semPasta}
            active={value === "sem-pasta"}
            onSelect={() => onChange("sem-pasta")}
            onDropPlan={dropOn(null)}
          />
        )}

        <button
          type="button"
          onClick={onCreate}
          className={cn(
            "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-dashed border-admin-border px-3 py-2 text-sm font-medium text-admin-foreground/60 transition-colors",
            "hover:border-gold-300 hover:bg-gold-50 hover:text-admin-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 lg:mt-1.5",
          )}
        >
          <FolderPlusIcon className="h-4 w-4" />
          Nova pasta
        </button>
      </div>
    </nav>
  );
}

/** Só faz sentido na coluna: no rolamento horizontal do celular, atrapalha. */
function RailHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="hidden px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-admin-foreground/40 lg:block">
      {children}
    </p>
  );
}

function RailItem({
  label,
  hint,
  count,
  dot,
  active,
  onSelect,
  menu,
  onDropPlan,
}: {
  label: string;
  hint?: string;
  count: number;
  dot?: string;
  active: boolean;
  onSelect: () => void;
  menu?: React.ReactNode;
  /** Definido só enquanto há aula no ar e este item é um lugar de verdade. */
  onDropPlan?: () => void;
}) {
  /**
   * `dragenter`/`dragleave` disparam também ao passar pelos filhos, então um
   * booleano piscaria. O contador só zera quando a última saída acontece.
   */
  const [depth, setDepth] = useState(0);
  const over = depth > 0;

  // Sem `preventDefault` no dragover o navegador recusa a soltura — é assim
  // que a API de arrasto pergunta "este alvo aceita?".
  const dropProps = onDropPlan
    ? {
        onDragEnter: () => setDepth((value) => value + 1),
        onDragLeave: () => setDepth((value) => Math.max(0, value - 1)),
        onDragOver: (event: React.DragEvent) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        },
        onDrop: (event: React.DragEvent) => {
          event.preventDefault();
          setDepth(0);
          onDropPlan();
        },
      }
    : undefined;

  return (
    <div
      {...dropProps}
      className={cn(
        "flex shrink-0 items-center rounded-xl border transition-colors",
        active
          ? "border-gold-300 bg-gold-50"
          : "border-admin-border hover:bg-admin-muted lg:border-transparent",
        // O alvo se anuncia antes de ser tocado: tracejado enquanto a aula
        // está no ar, sólido e dourado quando ela está por cima.
        onDropPlan && !over && "border-dashed border-gold-300/70",
        over && "border-solid border-gold-500 bg-gold-100",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        title={hint}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
      >
        {dot ? (
          <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
        ) : (
          <FolderIcon
            aria-hidden
            className={cn(
              "h-4 w-4 shrink-0",
              active ? "text-gold-600" : "text-admin-foreground/35",
            )}
          />
        )}
        <span
          className={cn(
            "truncate whitespace-nowrap text-sm",
            active ? "font-semibold text-admin-foreground" : "text-admin-foreground/75",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-1.5 text-[11px] font-semibold tabular",
            active
              ? "bg-gold-100 text-gold-700"
              : "bg-admin-muted text-admin-foreground/45",
          )}
        >
          {count}
        </span>
      </button>
      {menu && <span className="pr-1">{menu}</span>}
    </div>
  );
}

/**
 * Criar ou renomear pasta. O mesmo diálogo serve aos dois porque os campos
 * são os mesmos — quem decide é a presença de `folder`.
 */
export function FolderFormDialog({
  open,
  onClose,
  folder,
}: {
  open: boolean;
  onClose: () => void;
  folder?: PlannerFolder;
}) {
  const action = folder
    ? updatePlannerFolderAction.bind(null, folder.id)
    : createPlannerFolderAction;
  const [state, formAction, isPending] = useActionState(action, null);
  const [color, setColor] = useState<PlannerFolderColor>(folder?.color ?? "gold");

  const fields = state && !state.success ? state.error.fields : undefined;

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  // O diálogo continua montado entre aberturas; sem isto, editar a pasta B
  // logo depois da A mostraria a cor da A.
  useEffect(() => {
    if (open) setColor(folder?.color ?? "gold");
  }, [open, folder]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={folder ? "Renomear pasta" : "Nova pasta"}
      description={
        folder
          ? "O nome e a cor mudam só para você — a estante é pessoal."
          : "Um lugar seu para agrupar aulas: por turma, por tema, pelo que fizer sentido."
      }
    >
      <form action={formAction} className="space-y-5" noValidate>
        {state && !state.success && !state.error.fields && (
          <FormBanner tone="error">{state.error.message}</FormBanner>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="folder-name" className="text-admin-foreground">
            Nome <span className="text-gold-600">*</span>
          </Label>
          <Input
            id="folder-name"
            name="name"
            maxLength={60}
            defaultValue={folder?.name}
            placeholder="Ex.: Gramática A2"
            autoComplete="off"
            required
            className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
          />
          <FieldError messages={fields?.["name"]} />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-admin-foreground">Cor</legend>
          <input type="hidden" name="color" value={color} />
          <div className="flex flex-wrap gap-2">
            {PLANNER_FOLDER_COLORS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setColor(item)}
                aria-pressed={color === item}
                title={COLOR_LABEL[item]}
                aria-label={COLOR_LABEL[item]}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full border-2 transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                  color === item ? "border-admin-foreground/40" : "border-transparent",
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full text-white",
                    COLOR_DOT[item],
                  )}
                >
                  {color === item && <CheckIcon className="h-3.5 w-3.5" />}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3 border-t border-admin-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-admin-border px-4 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-5 text-sm font-semibold text-admin-foreground",
              "shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            {isPending ? (
              <>
                <LogoLoader size={16} label={null} />
                Salvando…
              </>
            ) : folder ? (
              "Salvar pasta"
            ) : (
              "Criar pasta"
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Escolher a pasta de uma aula — inclusive "nenhuma", que a tira da estante. */
export function MovePlanDialog({
  open,
  onClose,
  folders,
  planTitle,
  currentFolderId,
  busy,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  folders: PlannerFolder[];
  planTitle: string;
  currentFolderId: string | null;
  busy: boolean;
  onConfirm: (folderId: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(currentFolderId);

  useEffect(() => {
    if (open) setSelected(currentFolderId);
  }, [open, currentFolderId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Mover para uma pasta"
      description={
        "“" +
        planTitle +
        "” continua compartilhada como está — a pasta só organiza a sua estante."
      }
    >
      <div className="space-y-1.5">
        {folders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-admin-border px-4 py-6 text-center text-sm text-admin-foreground/55">
            Você ainda não criou nenhuma pasta — use “Nova pasta”, na coluna do ateliê.
          </p>
        ) : (
          <>
            <FolderChoice
              label="Sem pasta"
              active={selected === null}
              onSelect={() => setSelected(null)}
            />
            {folders.map((folder) => (
              <FolderChoice
                key={folder.id}
                label={folder.name}
                dot={COLOR_DOT[folder.color] ?? COLOR_DOT.gold}
                active={selected === folder.id}
                onSelect={() => setSelected(folder.id)}
              />
            ))}
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-admin-border pt-4">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-xl border border-admin-border px-4 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || folders.length === 0 || selected === currentFolderId}
          onClick={() => onConfirm(selected)}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy-900 px-5 text-sm font-semibold text-white",
            "transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {busy ? (
            <>
              <LogoLoader size={16} label={null} />
              Movendo…
            </>
          ) : (
            "Mover aula"
          )}
        </button>
      </div>
    </Dialog>
  );
}

function FolderChoice({
  label,
  dot,
  active,
  onSelect,
}: {
  label: string;
  dot?: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        active
          ? "border-gold-400 bg-gold-50 font-semibold text-admin-foreground"
          : "border-admin-border text-admin-foreground/75 hover:bg-admin-muted",
      )}
    >
      {dot ? (
        <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", dot)} />
      ) : (
        <FolderIcon aria-hidden className="h-4 w-4 text-admin-foreground/35" />
      )}
      <span className="truncate">{label}</span>
      {active && <CheckIcon className="ml-auto h-4 w-4 text-gold-600" />}
    </button>
  );
}
