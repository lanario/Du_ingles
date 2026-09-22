import { CheckIcon, DownloadIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Atalhos para a folha de exercícios em PDF (`/api/assignments/[id]/pdf` ou
 * `/api/assignment-templates/[id]/pdf`). O PDF é gerado na hora pela rota,
 * que reaplica a permissão — aqui é só o link, aberto no visualizador do
 * navegador (de onde se imprime ou salva). Mesma pílula do botão de download
 * da Biblioteca (`.dl-btn`, em `globals.css`), fixada em `data-state="idle"`
 * porque aqui não há signed URL para esperar.
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
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Folha de exercícios para imprimir"
        data-state="idle"
        className="dl-btn"
      >
        <span className="dl-btn__circle">
          <DownloadIcon className="dl-btn__icon" />
        </span>
        <span className="dl-btn__label">
          {withAnswerKey ? "Folha em PDF" : "Baixar PDF"}
        </span>
      </a>
      {withAnswerKey && (
        <a
          href={`${href}?gabarito=1`}
          target="_blank"
          rel="noopener noreferrer"
          title="Versão do professor, com as respostas destacadas"
          data-state="idle"
          className="dl-btn dl-btn--accent"
        >
          <span className="dl-btn__circle">
            <CheckIcon className="dl-btn__icon" />
          </span>
          <span className="dl-btn__label">Gabarito</span>
        </a>
      )}
    </div>
  );
}
