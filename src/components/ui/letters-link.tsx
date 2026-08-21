import type { CSSProperties } from "react";
import Link from "next/link";
import type { Route } from "next";

const NBSP = " ";

type LettersLinkProps = {
  href: Route;
  label: string;
  className?: string;
};

/**
 * Link com aparência de botão em que, no hover, a face sólida desce e as
 * letras entram uma a uma. O texto acessível fica na face de repouso; a
 * animação é decorativa e sai da árvore de acessibilidade.
 */
export function LettersLink({ href, label, className }: LettersLinkProps) {
  return (
    <Link href={href} className={["btn-letters", className].filter(Boolean).join(" ")}>
      <div className="btn-letters__face">{label}</div>
      <div className="btn-letters__letters" aria-hidden>
        {[...label].map((char, index) => (
          <span key={`${char}-${index}`} style={{ "--i": index } as CSSProperties}>
            {char === " " ? NBSP : char}
          </span>
        ))}
      </div>
    </Link>
  );
}
