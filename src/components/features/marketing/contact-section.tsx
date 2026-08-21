import { ContactForm } from "@/components/features/marketing/contact-form";

export function ContactSection() {
  return (
    <section id="contato">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Comece com uma aula experimental
          </h2>
          <p className="mt-3 text-muted-foreground">
            Preencha seus dados e a nossa equipe entra em contato para agendar seu
            diagnóstico gratuito.
          </p>
        </div>
        <div className="mt-10">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
