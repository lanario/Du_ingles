/**
 * Erro de um campo. Mostra TODAS as mensagens que a validação devolveu, não
 * só a primeira: uma senha sem maiúscula e sem número tem dois problemas, e
 * corrigir um de cada vez (com um submit entre eles) é o tipo de fricção que
 * faz a pessoa desistir do cadastro.
 */
export function FieldError({ id, messages }: { id?: string; messages?: string[] }) {
  if (!messages?.length) return null;

  if (messages.length === 1) {
    return (
      <p id={id} role="alert" className="text-sm text-destructive">
        {messages[0]}
      </p>
    );
  }

  return (
    <ul id={id} role="alert" className="space-y-0.5 text-sm text-destructive">
      {messages.map((message) => (
        <li key={message} className="flex gap-1.5">
          <span aria-hidden>•</span>
          <span>{message}</span>
        </li>
      ))}
    </ul>
  );
}

export function FormBanner({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
      }
    >
      {children}
    </div>
  );
}
