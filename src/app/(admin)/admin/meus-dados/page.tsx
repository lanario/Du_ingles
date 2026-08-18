import type { Metadata } from "next";
import { LgpdPanel } from "@/components/features/lgpd/lgpd-panel";

export const metadata: Metadata = { title: "Meus dados" };

export default function MeusDadosPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Meus dados</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Seus direitos como titular de dados pessoais, conforme a LGPD.
      </p>
      <div className="mt-8">
        <LgpdPanel theme="admin" />
      </div>
    </div>
  );
}
