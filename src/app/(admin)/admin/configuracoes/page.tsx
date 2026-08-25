import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { isStripeConfigured, isStripeLiveMode } from "@/lib/stripe/client";
import { getConnectAccount } from "@/repositories/stripe-connect";
import { SettingsView } from "@/components/features/admin/settings/settings-view";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const ctx = await requireRole(["admin"]);
  const account = await getConnectAccount(ctx.organizationId);

  return (
    <SettingsView
      account={account}
      stripeConfigured={isStripeConfigured()}
      stripeLiveMode={isStripeLiveMode()}
    />
  );
}
