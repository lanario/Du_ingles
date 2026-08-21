import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";

/**
 * Cartão flutuante sobre a prévia do painel: mostra uma aula "acontecendo
 * agora" com o professor e leva para o formulário de cadastro (`#contato`),
 * o mesmo destino do CTA principal do hero.
 *
 * É conteúdo de verdade (link real), por isso vive fora do DashboardPreview —
 * a maquete é `aria-hidden` e não pode conter algo navegável.
 */

const TEACHER = {
  name: "Prof. Lucas",
  photo: "/prof-lucas.jpg",
  level: "Nível B2",
  topic: "Conversação: Negociações em Inglês",
} as const;

/**
 * Enquanto a foto não estiver em `public/`, o cartão cai nas iniciais em vez
 * de mostrar uma imagem quebrada. Pode sumir daqui quando o arquivo entrar
 * no repositório.
 */
const hasPhoto = existsSync(path.join(process.cwd(), "public", TEACHER.photo));

export function LiveClassCta() {
  return (
    <a
      href="#contato"
      className="group/cta mt-4 block rounded-2xl border border-border bg-background p-4 shadow-[0_24px_50px_-24px_rgba(10,31,68,0.55)] transition hover:border-gold-400 md:absolute md:-bottom-8 md:-left-10 md:mt-0 md:w-[19rem]"
    >
      <div className="flex items-start gap-3">
        <span className="relative flex-none rounded-full ring-2 ring-gold-400 ring-offset-2 ring-offset-background">
          {hasPhoto ? (
            <Image
              src={TEACHER.photo}
              alt={`${TEACHER.name}, professor de inglês`}
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-gold-300">
              PL
            </span>
          )}
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-navy-900 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wide text-gold-300">
            Ao vivo
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-navy-900">{TEACHER.name}</p>
            <span className="inline-flex flex-none items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              Live
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {TEACHER.level} · {TEACHER.topic}
            <span className="font-medium text-gold-700"> (acontecendo agora!)</span>
          </p>
        </div>
      </div>

      <p className="mt-3 border-t border-border pt-3 text-[11px] font-medium text-navy-800">
        Quero uma aula assim: agendar minha aula grátis
        <span className="ml-1 inline-block transition-transform group-hover/cta:translate-x-0.5">
          →
        </span>
      </p>
    </a>
  );
}
