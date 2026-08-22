"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LettersLink } from "@/components/ui/letters-link";
import { SlideTabs, type SlideTabItem } from "@/components/ui/slide-tabs";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const LINKS: SlideTabItem[] = [
  { href: "#metodologia", label: "Metodologia" },
  { href: "#niveis", label: "Turmas" },
  { href: "#professores", label: "Professores" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

/**
 * Cabeçalho da landing. Duas navegações com o mesmo mapa de seções, uma para
 * cada tamanho de tela — o mesmo desenho da área logada (§8.1):
 *
 * - `>= lg`: a pílula `SlideTabs` com cursor deslizante.
 * - `< lg`: botão de menu + gaveta lateral por toque. O corte é em `lg` e
 *   não em `md` porque a pílula com cinco abas mede ~576px e, somada ao logo
 *   e ao botão "Já sou aluno", pede uns 860px de barra — em 768px ela vaza.
 *
 * No repouso o cabeçalho é transparente (o degradê dourado do fundo aparece
 * inteiro). Depois do primeiro scroll ele ganha véu branco + blur: como o
 * fundo é `fixed`, sem isso o texto da página passaria por baixo do logo.
 */
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Trava a rolagem do documento enquanto a gaveta está aberta — sem isso a
  // página corre atrás do overlay quando o dedo arrasta fora do painel.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-300",
        "pt-[env(safe-area-inset-top,0px)]",
        scrolled
          ? "border-b border-border/60 bg-white/80 backdrop-blur-md lg:border-transparent lg:bg-transparent lg:backdrop-blur-none"
          : "bg-transparent",
      )}
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 lg:h-24">
        <Link href="/" className="flex items-center" aria-label="Du Inglês">
          <Image
            src="/du_ingles_logo.svg"
            alt="Du Inglês"
            width={72}
            height={72}
            priority
            className="h-11 w-auto lg:h-[4.5rem]"
          />
        </Link>

        <div className="hidden lg:flex">
          <SlideTabs items={LINKS} label="Seções da página" />
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <LettersLink href="/login" label="Já sou aluno" />
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="-mr-2 grid h-11 w-11 place-items-center rounded-xl text-navy-900 transition-colors active:bg-navy-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-navy-950/50 backdrop-blur-[2px]"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navegação"
              initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col bg-[linear-gradient(160deg,var(--navy-900)_0%,var(--navy-950)_100%)] text-white shadow-2xl"
            >
              <div className="flex h-16 shrink-0 items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
                  Menu
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar menu"
                  className="-mr-2 grid h-11 w-11 place-items-center rounded-xl text-white/70 transition-colors active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  <CloseIcon className="h-6 w-6" />
                </button>
              </div>

              <nav
                aria-label="Seções da página"
                className="flex-1 overflow-y-auto overscroll-contain px-3 py-2"
              >
                <ul className="space-y-1">
                  {LINKS.map((link) => (
                    <li key={link.href}>
                      {/* Âncora na mesma página: `<a>` puro preserva o scroll
                          suave nativo do CSS (o mesmo motivo do SlideTabs). */}
                      <a
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="flex min-h-12 items-center justify-between rounded-xl px-4 text-[15px] font-medium text-white/85 transition-colors active:bg-gold-400/15 active:text-gold-200"
                      >
                        {link.label}
                        <span aria-hidden className="text-gold-400/70">
                          →
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="shrink-0 space-y-2.5 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4">
                <a
                  href="#faq"
                  onClick={() => setOpen(false)}
                  className="flex min-h-13 w-full items-center justify-center rounded-2xl bg-gold-500 px-4 text-center text-sm font-bold uppercase tracking-[0.06em] text-navy-950 shadow-[0_0_28px_-6px_rgba(201,162,39,0.7)]"
                >
                  Agendar aula grátis
                </a>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/20 px-4 text-sm font-semibold text-white/85"
                >
                  Já sou aluno
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}
