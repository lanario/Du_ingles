import {
  SCHOOL_ADDRESS,
  SCHOOL_CNPJ,
  SCHOOL_EMAIL,
  SCHOOL_LEGAL_NAME,
  SCHOOL_PHONE_LABEL,
} from "@/lib/school-contact";

/**
 * Quem presta o serviço, em destaque (Decreto nº 7.962/2013, art. 2º; LGPD
 * art. 9º, III). Campo vazio em `school-contact.ts` simplesmente não aparece —
 * nunca um "[CNPJ]" publicado.
 */
export function LegalIdentity() {
  const lines = [
    SCHOOL_LEGAL_NAME ? `${SCHOOL_LEGAL_NAME} (Du Inglês)` : "Du Inglês",
    SCHOOL_CNPJ && `CNPJ ${SCHOOL_CNPJ}`,
    SCHOOL_ADDRESS,
    `${SCHOOL_EMAIL} · ${SCHOOL_PHONE_LABEL}`,
  ].filter(Boolean);

  return (
    <address className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-[13px] not-italic leading-relaxed">
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </address>
  );
}
