import { ScrollReveal } from "@/components/motion/scroll-reveal-dynamic";

const STATS = [
  { value: "500+", label: "alunos ativos" },
  { value: "12.000+", label: "horas de aula ministradas" },
  { value: "94%", label: "de satisfação dos alunos" },
  { value: "6", label: "níveis CEFR, do A1 ao C2" },
];

export function Stats() {
  return (
    <section>
      <ScrollReveal className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-14 md:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-3xl font-bold text-primary sm:text-4xl">{stat.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </ScrollReveal>
    </section>
  );
}
