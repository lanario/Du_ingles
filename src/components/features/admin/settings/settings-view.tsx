"use client";

/**
 * Configurações do admin em abas. Hoje só "Integrações financeiras" tem
 * conteúdo real — é onde a escola conecta a conta Stripe que recebe as
 * assinaturas dos alunos, reaproveitando o mesmo `ConnectCard` que aparece em
 * Planos de Alunos, já que as duas telas leem e escrevem a mesma conta
 * conectada.
 */

import { useState } from "react";
import { ShieldIcon, WalletIcon } from "@/components/ui/icons";
import { SlideTabs } from "@/components/ui/slide-tabs";
import { ConnectCard } from "@/components/features/admin/plans/connect-card";
import type { ConnectAccount } from "@/repositories/stripe-connect";

type Tab = "geral" | "financeiro";

const TABS: { id: Tab; label: string; icon: typeof ShieldIcon }[] = [
  { id: "geral", label: "Geral", icon: ShieldIcon },
  { id: "financeiro", label: "Integrações financeiras", icon: WalletIcon },
];

export function SettingsView({
  account,
  stripeConfigured,
  stripeLiveMode,
}: {
  account: ConnectAccount | null;
  stripeConfigured: boolean;
  stripeLiveMode: boolean;
}) {
  const [tab, setTab] = useState<Tab>("geral");

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
              <h2 className="text-base font-semibold text-admin-foreground">
                Stripe Connect
              </h2>
              <p className="mt-1 text-sm text-admin-foreground/60">
                Conecte a conta que vai receber os pagamentos das assinaturas
                dos alunos. O cadastro é feito na própria Stripe — nenhum dado
                bancário passa pela plataforma.
              </p>
            </div>

            <ConnectCard
              account={account}
              configured={stripeConfigured}
              liveMode={stripeLiveMode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
