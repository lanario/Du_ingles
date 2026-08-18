import { exitViewAsModeAction } from "@/actions/admin/view-as";

export function ViewAsBanner() {
  return (
    <div className="flex h-10 items-center justify-center gap-3 bg-admin-accent px-4 text-sm font-medium text-admin-accent-foreground">
      <span>Você está visualizando como Professor — modo somente leitura</span>
      <form action={exitViewAsModeAction}>
        <button type="submit" className="underline underline-offset-2">
          Voltar ao painel admin
        </button>
      </form>
    </div>
  );
}
