import { listPublicTeachers } from "@/repositories/teachers";
import { ScrollReveal } from "@/components/motion/scroll-reveal-dynamic";

export async function Teachers() {
  const teachers = await listPublicTeachers();

  return (
    <section id="professores">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Professores</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Um time formado e experiente, dedicado a acompanhar sua evolução de perto.
        </p>

        {teachers.length === 0 ? (
          <p className="mt-12 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            Os perfis dos nossos professores estão a caminho — em breve você conhece o
            time por aqui.
          </p>
        ) : (
          <ScrollReveal className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                className="rounded-lg border border-border bg-background p-6"
              >
                <div className="mb-4 h-16 w-16 rounded-full bg-primary/15" />
                <h3 className="font-semibold">{teacher.fullName}</h3>
                {teacher.bio && (
                  <p className="mt-2 text-sm text-muted-foreground">{teacher.bio}</p>
                )}
                {teacher.specialties.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {teacher.specialties.map((s) => (
                      <li
                        key={s}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </ScrollReveal>
        )}
      </div>
    </section>
  );
}
