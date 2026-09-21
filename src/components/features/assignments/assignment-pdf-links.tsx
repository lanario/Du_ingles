import { CheckIcon, DownloadIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Atalhos para a folha de exercícios em PDF (`/api/assignments/[id]/pdf` ou
 * `/api/assignment-templates/[id]/pdf`). O PDF é gerado na hora pela rota,
 * que reaplica a permissão — aqui é só o link, aberto no visualizador do
 * navegador (de onde se imprime ou salva).
 *
 * `withAnswerKey` acrescenta a versão do professor; a rota ignora
 * `?gabarito=1` vindo de aluno, então esconder o botão é conforto, não tranca.
 */
export function AssignmentPdfLinks({
  href,
  withAnswerKey = false,
  className,
}: {
  href: `/api/${string}/pdf`;
  withAnswerKey?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Folha de exercícios para imprimir"
        className={cn(
          base,
          "border-navy-100 bg-navy-50 text-navy-800 hover:border-navy-300 hover:bg-navy-100",
        )}
      >
        <DownloadIcon className="h-3.5 w-3.5" />
        {withAnswerKey ? "Folha em PDF" : "Baixar PDF"}
      </a>
      {withAnswerKey && (
        <a
          href={`${href}?gabarito=1`}
          target="_blank"
          rel="noopener noreferrer"
          title="Versão do professor, com as respostas destacadas"
          className={cn(
            base,
            "border-gold-300 bg-gold-50 text-gold-700 hover:border-gold-400 hover:bg-gold-100",
          )}
        >
          <CheckIcon className="h-3.5 w-3.5" />
          Gabarito
        </a>
      )}
    </div>
  );
}
