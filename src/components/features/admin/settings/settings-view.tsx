"use client";

/**
 * Configurações do admin em abas. Hoje só "Integrações financeiras" tem
 * conteúdo real — mostra o estado da conta Stripe única que processa as
 * assinaturas dos alunos.
 */

import { CheckIcon, ShieldIcon, WalletIcon } from "@/components/ui/icons";
import { SlideTabs } from "@/components/ui/slide-tabs";
import { usePersistedChoice } from "@/hooks/use-persisted-choice";

type Tab = "geral" | "financeiro";

const TABS: { id: Tab; label: string; icon: typeof ShieldIcon }[] = [
  { id: "geral", label: "Geral", icon: ShieldIcon },
  { id: "financeiro", label: "Integrações financeiras", icon: WalletIcon },
];

export function SettingsView({
  stripeConfigured,
  stripeLiveMode,
}: {
  stripeConfigured: boolean;
  stripeLiveMode: boolean;
}) {
  const [tab, setTab] = usePersistedChoice<Tab>("du:configuracoes:tab", (raw) =>
    raw === "financeiro" ? "financeiro" : "geral",
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Preferências e configurações gerais da plataforma.
      </p>

      <SlideTabs
        className="mt-5"
        tone="surface"
        label="Seções de configurações"
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        items={TABS.map(({ id, label, icon: Icon }) => ({
          value: id,
          label,
          icon: <Icon aria-hidden />,
        }))}
      />

      <div className="mt-6">
        {tab === "geral" ? (
          <p className="rounded-lg border border-dashed border-admin-border p-10 text-center text-admin-foreground/70">
            Esta página está em construção.
          </p>
        ) : (
          <div className="max-w-2xl space-y-3">
            <div>
              <h2 className="text-base font-semibold text-admin-foreground">Stripe</h2>
              <p className="mt-1 text-sm text-admin-foreground/60">
                As assinaturas dos alunos são cobradas pela conta Stripe da própria
                plataforma. Nenhum dado bancário passa por aqui.
              </p>
            </div>

            {stripeConfigured ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-admin-border bg-admin-surface px-4 py-3">
                <span
                  aria-hidden
                  style={{
                    color: "var(--success)",
                    backgroundColor: "color-mix(in srgb, var(--success) 12%, #ffffff)",
                  }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                >
                  <CheckIcon className="h-4.5 w-4.5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-admin-foreground">
                    Stripe conectada
                    {!stripeLiveMode && (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_12%,#ffffff)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--warning)]">
                        modo de teste
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12px] text-admin-foreground/55">
                    Cobrança direta, sem repasse — a plataforma recebe e gerencia todo o
                    fluxo de pagamento.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--warning)_32%,transparent)] bg-[color-mix(in_srgb,var(--warning)_6%,#ffffff)] p-4">
                <span
                  aria-hidden
                  style={{
                    color: "var(--warning)",
                    backgroundColor: "color-mix(in srgb, var(--warning) 12%, #ffffff)",
                  }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                >
                  <ShieldIcon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-admin-foreground">
                    Stripe não configurada neste ambiente
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-admin-foreground/60">
                    Defina{" "}
                    <code className="font-mono text-[12px]">STRIPE_SECRET_KEY</code> e{" "}
                    <code className="font-mono text-[12px]">STRIPE_WEBHOOK_SECRET</code>{" "}
                    no ambiente para habilitar cobranças.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
