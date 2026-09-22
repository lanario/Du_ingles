import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import {
  ACCENT_TONE,
  TIER_ACCENT,
  TIER_LABEL,
  TIER_ORDER,
  TIER_TAGLINE,
  tierOwnFeatures,
} from "@/components/features/admin/plans/plans-utils";
import type { PlanTier } from "@/schemas/student-plans";

/**
 * Tabela "o que tem em um que não tem no outro" — complemento do construtor
 * de planos acima. O construtor mostra o resultado de uma escolha por vez;
 * esta tabela deixa os três níveis lado a lado, linha por benefício, para
 * quem quer comparar antes de decidir.
 *
 * Os benefícios são cumulativos (Premium herda o Standard, Elite herda o
 * Premium — ver `tierOwnFeatures`), então cada bloco de linhas pertence ao
 * nível em que o benefício aparece pela primeira vez, e os níveis acima dele
 * também marcam "incluso".
 */
const GROUP_LABEL: Record<PlanTier, string> = {
  standard: "Em todos os planos",
  premium: "A mais no Premium",
  elite: "A mais no Elite",
};

const tierIndex = (tier: PlanTier) => TIER_ORDER.indexOf(tier);

export function PlanComparison() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:pb-20">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Compare os planos</h2>
      <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
        Cada nível soma os benefícios do anterior — veja o que cada um acrescenta.
      </p>

      <div
        className="mt-8 overflow-x-auto rounded-2xl"
        style={{
          boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--navy-600) 22%, transparent)",
        }}
      >
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr
              style={{
                background:
                  "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 60%, var(--navy-800) 100%)",
              }}
            >
              <th className="px-5 py-4 text-sm font-semibold text-white">Benefícios</th>
              {TIER_ORDER.map((tier) => {
                const tone = ACCENT_TONE[TIER_ACCENT[tier]];
                return (
                  <th key={tier} className="px-5 py-4 text-center">
                    <span className="block text-sm font-bold text-white">
                      {TIER_LABEL[tier]}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium" style={{ color: tone }}>
                      {TIER_TAGLINE[tier]}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {TIER_ORDER.map((groupTier) => (
              <ComparisonGroup key={groupTier} groupTier={groupTier} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ComparisonGroup({ groupTier }: { groupTier: PlanTier }) {
  const rows = tierOwnFeatures(groupTier);
  const groupIndex = tierIndex(groupTier);

  return (
    <>
      <tr>
        <td
          colSpan={TIER_ORDER.length + 1}
          className="border-t border-border bg-muted/40 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
        >
          {GROUP_LABEL[groupTier]}
        </td>
      </tr>
      {rows.map((feature) => (
        <tr key={feature} className="border-t border-border bg-background">
          <td className="px-5 py-3 text-[13px] leading-snug text-foreground">{feature}</td>
          {TIER_ORDER.map((tier) => {
            const included = tierIndex(tier) >= groupIndex;
            const tone = ACCENT_TONE[TIER_ACCENT[tier]];
            return (
              <td key={tier} className="px-5 py-3 text-center">
                {included ? (
                  <span
                    aria-hidden
                    className="mx-auto grid h-5 w-5 place-items-center rounded-full"
                    style={{ backgroundColor: tone }}
                  >
                    <CheckIcon
                      className="h-3 w-3"
                      style={{ color: "var(--navy-950)" }}
                      strokeWidth={3}
                    />
                  </span>
                ) : (
                  <CloseIcon
                    aria-hidden
                    className="mx-auto h-3.5 w-3.5 text-muted-foreground/30"
                    strokeWidth={2}
                  />
                )}
                <span className="sr-only">
                  {included ? "Incluso" : "Não incluso"} no {TIER_LABEL[tier]}
                </span>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
