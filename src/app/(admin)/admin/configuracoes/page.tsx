import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { isStripeConfigured, isStripeLiveMode } from "@/lib/stripe/client";
import { SettingsView } from "@/components/features/admin/settings/settings-view";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await requireRole(["admin"]);

  return (
    <SettingsView stripeConfigured={isStripeConfigured()} stripeLiveMode={isStripeLiveMode()} />
  );
}
