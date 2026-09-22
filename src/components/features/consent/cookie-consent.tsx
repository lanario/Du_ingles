"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  acceptAll,
  onOpenCookiePreferences,
  openCookiePreferences,
  rejectOptional,
  saveConsent,
  useConsent,
} from "@/lib/consent/client";
import {
  NO_CONSENT,
  categoriesInUse,
  type ConsentChoices,
  type OptionalCategory,
} from "@/lib/consent/config";
import { cn } from "@/lib/utils";

/**
 * Banner e janela de preferências de cookies — montados no layout raiz, então
 * valem para o site público e para as áreas logadas (que também guardam
 * preferências no navegador).
 *
 * O que o Guia de Cookies da ANPD pede e este componente cumpre:
 *   - aceitar e recusar lado a lado, com o mesmo peso visual;
 *   - nada pré-marcado: a janela abre com tudo opcional desligado;
 *   - escolha por categoria, com a finalidade de cada uma;
 *   - revogar é tão fácil quanto aceitar (link no rodapé e em "Meus dados");
 *   - sem "cookie wall": a página continua usável com o banner aberto.
 *
 * Ele mora no `z-50`, acima da barra de CTA e do botão de topo: enquanto o
 * aviso está na tela, ele é a única coisa que importa na base da janela.
 */
export function CookieConsent() {
  const consent = useConsent();
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => onOpenCookiePreferences(() => setPreferencesOpen(true)), []);

  // `undefined` = ainda hidratando; o banner só aparece quando o navegador
  // confirmou que não há decisão — senão ele piscaria para quem já escolheu.
  const bannerVisible = consent === null && !preferencesOpen;

  useEffect(() => {
    // A barra de CTA e o botão "voltar ao topo" se afastam da base enquanto o
    // aviso ocupa o rodapé — sem isso os três se empilham no mesmo canto.
    document.documentElement.classList.toggle("has-cookie-notice", bannerVisible);
    return () => document.documentElement.classList.remove("has-cookie-notice");
  }, [bannerVisible]);

  return (
    <>
      {bannerVisible && (
        <div
          role="region"
          aria-label="Aviso de cookies"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] shadow-lg backdrop-blur"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <p className="text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
              Usamos cookies essenciais para o login funcionar. Com a sua permissão,
              também guardamos preferências de tela neste aparelho. Nada de publicidade ou
              rastreamento de terceiros. Saiba mais na{" "}
              <Link href="/cookies" className="underline">
                política de cookies
              </Link>
              .
            </p>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button
                variant="outline"
                className="min-h-11 hover:border-accent! hover:bg-accent! hover:text-accent-foreground! sm:min-h-0"
                onClick={rejectOptional}
              >
                Recusar
              </Button>
              <Button
                variant="outline"
                className="min-h-11 hover:border-accent! hover:bg-accent! hover:text-accent-foreground! sm:min-h-0"
                onClick={acceptAll}
              >
                Aceitar
              </Button>
              <Button
                variant="ghost"
                className="col-span-2 min-h-11 underline-offset-4 hover:bg-transparent! hover:text-accent! hover:underline sm:min-h-0"
                onClick={() => setPreferencesOpen(true)}
              >
                Personalizar
              </Button>
            </div>
          </div>
        </div>
      )}

      <CookiePreferencesDialog
        open={preferencesOpen}
        initial={consent?.choices ?? NO_CONSENT}
        onClose={() => setPreferencesOpen(false)}
      />
    </>
  );
}

function CookiePreferencesDialog({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: ConsentChoices;
  onClose: () => void;
}) {
  const [choices, setChoices] = useState<ConsentChoices>(initial);

  // Reabre sempre com o que está valendo — não com o rascunho descartado.
  useEffect(() => {
    if (open) setChoices(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function save(next: ConsentChoices) {
    saveConsent(next);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Preferências de cookies"
      description="Escolha o que pode ficar guardado neste navegador. Você pode mudar a qualquer momento."
    >
      <ul className="space-y-3">
        {categoriesInUse().map((category) => (
          <li key={category.id} className="rounded-lg border border-border p-3.5">
            <CategoryRow
              label={category.label}
              description={category.description}
              required={category.required}
              checked={
                category.required || choices[category.id as OptionalCategory] === true
              }
              onChange={(value) =>
                setChoices((current) => ({
                  ...current,
                  [category.id as OptionalCategory]: value,
                }))
              }
            />
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        A lista completa, com nome e duração de cada item, está na{" "}
        <Link href="/cookies" className="underline" onClick={onClose}>
          política de cookies
        </Link>
        .
      </p>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => save({ ...NO_CONSENT })}>
          Recusar opcionais
        </Button>
        <Button onClick={() => save(choices)}>Salvar escolhas</Button>
      </div>
    </Dialog>
  );
}

function CategoryRow({
  label,
  description,
  required,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  required: boolean;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
        </label>
        <p
          id={`${id}-desc`}
          className="mt-1 text-[13px] leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
      </div>
      {required ? (
        <span className="shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
          Sempre ativos
        </span>
      ) : (
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={`${id}-desc`}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            checked ? "bg-primary" : "bg-muted-foreground/30",
          )}
        >
          <span className="sr-only">{checked ? "Ativado" : "Desativado"}</span>
          <span
            aria-hidden
            className={cn(
              "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
              checked ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      )}
    </div>
  );
}

/** Link/botão para reabrir as preferências (rodapé, "Meus dados"). */
export function CookiePreferencesLink({
  className,
  children = "Preferências de cookies",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={openCookiePreferences}>
      {children}
    </button>
  );
}
