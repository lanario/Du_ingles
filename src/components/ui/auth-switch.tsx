"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Card de acesso de duas faces: o formulário vive na metade branca e o painel
 * navy — o círculo que atravessa o card, desenhado em `globals.css` — carrega
 * o convite para a outra face.
 *
 * O componente é só a moldura e a coreografia: quem decide o que cada face
 * mostra é quem o usa. `contentKey` existe porque a face "entrar" troca de
 * conteúdo sem trocar de face (login ↔ recuperar senha) — mudar a chave
 * remonta o slot e roda a animação de entrada de novo.
 */

export type AuthMode = "entrar" | "cadastrar";

export interface AuthSwitchFace {
  title: string;
  description?: string;
  content: ReactNode;
}

/** Convite exibido no navy enquanto a face de mesma chave está aberta. */
export interface AuthSwitchPrompt {
  heading: string;
  text: string;
  /** Rótulo do botão que leva à outra face. */
  action: string;
}

export interface AuthSwitchHighlight {
  value: string;
  label: string;
}

export interface AuthSwitchProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  faces: Record<AuthMode, AuthSwitchFace>;
  prompts: Record<AuthMode, AuthSwitchPrompt>;
  /** Marca: no navy a partir de `lg`, acima do formulário nas telas estreitas. */
  brand?: ReactNode;
  highlights?: ReadonlyArray<AuthSwitchHighlight>;
  /** Identidade do conteúdo dentro da face aberta. Default: o modo. */
  contentKey?: string;
  className?: string;
}

const OTHER: Record<AuthMode, AuthMode> = {
  entrar: "cadastrar",
  cadastrar: "entrar",
};

export function AuthSwitch({
  mode,
  onModeChange,
  faces,
  prompts,
  brand,
  highlights,
  contentKey,
  className,
}: AuthSwitchProps) {
  const face = faces[mode];

  const panel = (side: AuthMode) => {
    const prompt = prompts[side];
    const active = mode === side;

    return (
      <div
        className={cn(
          "auth-card-panel",
          side === "entrar" ? "auth-card-panel--left" : "auth-card-panel--right",
        )}
        // O convite inativo continua no DOM (é ele que volta deslizando), então
        // precisa sair do foco e do leitor de tela enquanto está fora do card.
        aria-hidden={active ? undefined : true}
      >
        <div className="auth-card-prompt">
          {brand ? <div className="hidden lg:block">{brand}</div> : null}

          <div>
            <h2 className="auth-card-prompt-heading">{prompt.heading}</h2>
            <p className="mt-2 text-sm text-app-shell-foreground/75">{prompt.text}</p>
          </div>

          <button
            type="button"
            className="auth-card-cta"
            tabIndex={active ? undefined : -1}
            onClick={() => onModeChange(OTHER[side])}
          >
            {prompt.action}
          </button>

          {highlights?.length ? (
            <dl className="hidden w-full grid-cols-3 gap-3 pt-2 lg:grid">
              {highlights.map((item) => (
                <div key={item.label}>
                  <dt className="text-lg font-bold text-accent">{item.value}</dt>
                  <dd className="mt-0.5 text-[0.6875rem] leading-tight text-app-shell-foreground/70">
                    {item.label}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("auth-card", className)} data-mode={mode}>
      <div className="auth-card-forms">
        {brand ? <div className="mb-6 flex justify-center lg:hidden">{brand}</div> : null}

        <div className="auth-card-slots">
          {/* `key`: remontar zera o formulário anterior e roda a entrada. */}
          <div
            key={contentKey ?? mode}
            className="text-center motion-safe:animate-[auth-panel-in_320ms_ease-out]"
          >
            <h2 className="auth-card-title">{face.title}</h2>
            {face.description ? (
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
                {face.description}
              </p>
            ) : null}
            <div className="mt-6">{face.content}</div>
          </div>
        </div>
      </div>

      <div className="auth-card-panels">
        {panel("entrar")}
        {panel("cadastrar")}
      </div>
    </div>
  );
}
