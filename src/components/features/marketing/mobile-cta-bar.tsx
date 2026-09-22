"use client";

import { useEffect, useState } from "react";

/**
 * Barra de ação fixa no rodapé, só no celular.
 *
 * No celular a barra mantém um caminho direto para o cadastro depois da
 * primeira dobra e some quando a seção final de conversão já está visível:
 *
 * - antes de sair da primeira dobra (o CTA do hero ainda está na tela);
 * - quando a seção de conversão aparece (o cadastro já está a um clique dali).
 */
export function MobileCtaBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.querySelector("#faq");

    // Duas condições independentes; a barra só entra quando as duas passam.
    let pastHero = false;
    let formOnScreen = false;
    const sync = () => setVisible(pastHero && !formOnScreen);

    const onScroll = () => {
      pastHero = window.scrollY > window.innerHeight * 0.85;
      sync();
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const observer = target
      ? new IntersectionObserver(
          ([entry]) => {
            formOnScreen = entry?.isIntersecting ?? false;
            sync();
          },
          { rootMargin: "-15% 0px -25% 0px" },
        )
      : null;
    if (target && observer) observer.observe(target);

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`mobile-cta-bar fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-white/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-md transition-[opacity,transform] duration-300 md:hidden ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-navy-900">
            Experimente por 7 dias
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Primeira cobrança só depois desse período
          </p>
        </div>
        <a
          href="/cadastro"
          tabIndex={visible ? 0 : -1}
          className="inline-flex min-h-12 flex-none items-center justify-center rounded-full bg-navy-800 px-5 text-[13px] font-bold uppercase tracking-[0.06em] text-white shadow-[0_8px_20px_-6px_rgba(10,31,68,0.5)] active:bg-gold-500 active:text-navy-950"
        >
          Cadastrar-se
        </a>
      </div>
    </div>
  );
}
