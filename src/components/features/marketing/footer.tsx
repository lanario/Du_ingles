"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { motion } from "framer-motion";
import gsap from "gsap";
import {
  SCHOOL_EMAIL as EMAIL,
  SCHOOL_PHONE as PHONE,
  SCHOOL_PHONE_HREF as PHONE_HREF,
  SCHOOL_PHONE_LABEL as PHONE_LABEL,
} from "@/lib/school-contact";
import { whatsappUrl } from "@/lib/phone";
import { MailIcon, MessageIcon, PhoneIcon, type IconProps } from "@/components/ui/icons";
import { isLiteMode } from "@/lib/perf";
import { CookiePreferencesLink } from "@/components/features/consent/cookie-consent";

const NAV_LINKS = [
  { href: "#metodologia", label: "Metodologia" },
  { href: "#niveis", label: "Turmas" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

const LEGAL_LINKS: { href: Route; label: string }[] = [
  { href: "/privacidade", label: "Política de privacidade" },
  { href: "/termos", label: "Termos de uso" },
  { href: "/cookies", label: "Política de cookies" },
];

const WHATSAPP_MESSAGE =
  "Olá! Vim do site da Du Inglês e quero saber mais sobre as aulas.";

/**
 * Rodapé da landing. Depois do dourado contínuo do `ShaderBackground`
 * (§ hero.tsx), fechar em azul marinho sólido é o que separa "fim do
 * conteúdo" de "fim da página" — o mesmo par de cores do resto da marca,
 * só que invertido, como o menu mobile já faz.
 *
 * Entrada em cascata por GSAP (uma vez): a régua dourada estica primeiro, as
 * colunas sobem em seguida. O hover de cada elemento — link, ícone, CTA — é
 * Framer, porque é ciclo de vida de interação, não de rolagem.
 *
 * O gatilho é `IntersectionObserver`, não `ScrollTrigger` — o mesmo motivo do
 * `ScrollReveal` (§ scroll-reveal.tsx): o rodapé é a última coisa da página,
 * então o `MeshGradient` do hero e as imagens acima ainda estão assentando o
 * layout quando este efeito monta. O `ScrollTrigger` mede a posição do
 * elemento nesse instante e nunca recalcula sozinho — a entrada nascia presa
 * em `opacity: 0`. O observer é sempre relativo à viewport real.
 */
export function MarketingFooter() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const divider = root.querySelector("[data-footer-divider]");
    const cols = root.querySelectorAll("[data-footer-col]");
    const glows = root.querySelectorAll("[data-footer-glow]");

    gsap.set(divider, { scaleX: 0 });
    gsap.set(cols, { y: 28, opacity: 0 });

    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      observer.disconnect();
      window.clearTimeout(failsafe);
      gsap
        .timeline()
        .to(divider, { scaleX: 1, duration: 0.9, ease: "power3.inOut" })
        .to(
          cols,
          { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out" },
          "-=0.55",
        );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) play();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(root);

    // Rede de segurança: se em 4s o observer não disparou (medida perdida
    // por algum motivo), revela assim mesmo — o pior caso é perder a entrada
    // em cascata, nunca deixar o rodapé preso invisível.
    const failsafe = window.setTimeout(play, 4000);

    // Halos ambientes: deriva lenta e infinita, só decoração de fundo — e
    // por ser decoração, é a primeira coisa a cair no modo leve.
    if (!isLiteMode())
      glows.forEach((glow, index) => {
        gsap.to(glow, {
          x: index % 2 === 0 ? 26 : -22,
          y: index % 2 === 0 ? -18 : 20,
          duration: 9 + index,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      });

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
      gsap.killTweensOf([divider, ...cols, ...glows]);
      gsap.set([divider, cols], { clearProps: "all" });
    };
  }, []);

  return (
    <footer
      ref={rootRef}
      className="relative overflow-hidden bg-[linear-gradient(175deg,var(--navy-900)_0%,var(--navy-950)_55%,#03081a_100%)] text-white"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          data-footer-glow
          className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-gold-500/10 blur-[100px]"
        />
        <div
          data-footer-glow
          className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-navy-500/20 blur-[110px]"
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pt-14 sm:pt-16">
        <div className="flex flex-col items-start justify-between gap-7 pb-12 sm:flex-row sm:items-center sm:gap-6 sm:pb-14">
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">
              Ainda com dúvidas?
            </p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-balance sm:text-3xl">
              Fale com a gente e comece a falar inglês essa semana.
            </h2>
          </div>
          <FooterCta />
        </div>

        <div
          data-footer-divider
          aria-hidden
          className="h-px w-full origin-left bg-gradient-to-r from-transparent via-gold-400/60 to-transparent"
        />

        <div className="grid gap-10 py-12 sm:grid-cols-2 sm:gap-8 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:py-14">
          <div data-footer-col>
            <Link href="/" className="inline-flex items-center" aria-label="Du Inglês">
              <Image
                src="/logo_amarela.svg"
                alt="Du Inglês"
                width={56}
                height={56}
                className="h-11 w-auto"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-300">
              Escola de inglês com aulas 100% ao vivo, nivelamento pelo padrão CEFR e
              progresso que dá para medir.
            </p>
            <FooterIconLinks />
            <FooterLink href="/login" route className="mt-5">
              Já sou aluno
            </FooterLink>
            <FooterLink href="/cadastro" route className="mt-3">
              Cadastre-se
            </FooterLink>
          </div>

          <div data-footer-col>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-300">
              Navegação
            </p>
            <ul className="mt-4 space-y-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          <div data-footer-col>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-300">
              Contato
            </p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <FooterLink href={`mailto:${EMAIL}`} className="break-all">
                  {EMAIL}
                </FooterLink>
              </li>
              <li>
                <FooterLink href={PHONE_HREF}>{PHONE_LABEL}</FooterLink>
              </li>
              <li>
                <FooterLink href={whatsappUrl(PHONE, WHATSAPP_MESSAGE)} external>
                  Chamar no WhatsApp
                </FooterLink>
              </li>
            </ul>
          </div>

          <div data-footer-col>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-300">
              Institucional
            </p>
            <ul className="mt-4 space-y-2.5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} route>
                    {link.label}
                  </FooterLink>
                </li>
              ))}
              <li>
                <CookiePreferencesLink className="group relative inline-flex w-fit items-center py-1 text-[13px] font-medium text-navy-300 transition-colors duration-200 hover:text-white focus-visible:text-white focus-visible:outline-none">
                  Preferências de cookies
                </CookiePreferencesLink>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-white/10 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-xs text-navy-300">
            © {new Date().getFullYear()} Du Inglês. Todos os direitos reservados.
          </p>
          <p className="text-xs text-navy-300">
            Feito com carinho para quem quer aprender de verdade.
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * CTA da faixa superior. Fundo dourado sólido — o inverso do `.btn-cta-fill`
 * do hero, que nasce navy sobre branco — porque aqui o canvas já é escuro.
 */
function FooterCta() {
  return (
    <motion.a
      href="/cadastro"
      whileHover={{ y: -3, boxShadow: "0 16px 40px -10px rgba(201,162,39,0.55)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      className="inline-flex min-h-13 shrink-0 items-center justify-center rounded-full bg-gold-500 px-7 text-sm font-bold uppercase tracking-[0.06em] text-navy-950 shadow-[0_10px_28px_-8px_rgba(201,162,39,0.5)]"
    >
      Experimente por 7 dias
    </motion.a>
  );
}

/**
 * Link de texto do rodapé — sublinhado dourado que cresce da esquerda no
 * hover/foco. `route` usa o `Link` do Next (rotas internas tipadas);
 * `external` abre em nova aba (WhatsApp).
 */
function FooterLink({
  href,
  route,
  external,
  className,
  children,
}: {
  href: string;
  route?: boolean;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const linkClassName = [
    "group relative inline-flex w-fit items-center py-1 text-[13px] font-medium text-navy-300 transition-colors duration-200 hover:text-white focus-visible:text-white focus-visible:outline-none",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const underline = (
    <span
      aria-hidden
      className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-gold-400 transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
    />
  );

  if (route) {
    return (
      <Link href={href as Route} className={linkClassName}>
        {children}
        {underline}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={linkClassName}
    >
      {children}
      {underline}
    </a>
  );
}

const ICON_LINKS: {
  href: string;
  label: string;
  icon: (props: IconProps) => React.JSX.Element;
  external?: boolean;
}[] = [
  { href: `mailto:${EMAIL}`, label: "Enviar e-mail", icon: MailIcon },
  { href: PHONE_HREF, label: "Ligar", icon: PhoneIcon },
  {
    href: whatsappUrl(PHONE, WHATSAPP_MESSAGE),
    label: "WhatsApp",
    icon: MessageIcon,
    external: true,
  },
];

function FooterIconLinks() {
  return (
    <ul className="mt-5 flex items-center gap-2.5">
      {ICON_LINKS.map(({ href, label, icon: Icon, external }) => (
        <li key={label}>
          <motion.a
            href={href}
            aria-label={label}
            title={label}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            whileHover={{
              y: -3,
              backgroundColor: "var(--gold-500)",
              color: "var(--navy-950)",
            }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
            className="grid h-10 w-10 place-items-center rounded-full text-navy-300"
            style={{
              backgroundColor: "color-mix(in srgb, var(--navy-600) 40%, transparent)",
              boxShadow:
                "inset 0 0 0 1px color-mix(in srgb, var(--navy-500) 40%, transparent)",
            }}
          >
            <Icon className="h-4 w-4" />
          </motion.a>
        </li>
      ))}
    </ul>
  );
}
