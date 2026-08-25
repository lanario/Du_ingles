"use client";

/**
 * Modal de "Segurança" aberto a partir do menu da conta — substitui as
 * antigas páginas `/seguranca` e `/admin/seguranca`, no mesmo modelo do
 * `AccountModal`. GSAP cuida do selo (gira e solta um halo só na abertura);
 * Framer Motion cuida do resto: o `Dialog` e a entrada escalonada dos blocos.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import gsap from "gsap";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Dialog } from "@/components/ui/dialog";
import { PasswordForm } from "@/components/features/account/password-form";
import {
  accountClasses,
  type AccountTheme,
} from "@/components/features/account/account-theme";
import { ShieldIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface SecurityModalProps {
  open: boolean;
  onClose: () => void;
  theme: AccountTheme;
  dataHref: Route;
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};

export function SecurityModal({ open, onClose, theme, dataHref }: SecurityModalProps) {
  const classes = accountClasses(theme);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const haloRef = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  // Selo gira e acende ao abrir — só GSAP alcança o "back.out" de mola dupla
  // (rotação + halo) sem disputar o `transform` que o Framer já anima no Dialog.
  useEffect(() => {
    const badge = badgeRef.current;
    const halo = haloRef.current;
    if (!open || !badge || !halo) return;

    if (reduceMotion) return;

    const timeline = gsap
      .timeline({ delay: 0.1 })
      .fromTo(
        badge,
        { scale: 0.6, rotate: -18, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.45, ease: "back.out(2.2)" },
      )
      .fromTo(
        halo,
        { scale: 0.6, opacity: 0.55 },
        { scale: 1.9, opacity: 0, duration: 0.7, ease: "power2.out" },
        "-=0.25",
      );

    return () => {
      timeline.kill();
    };
  }, [open, reduceMotion]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Segurança"
      description={
        theme === "admin"
          ? "Sua senha de acesso ao painel."
          : "Sua senha de acesso à plataforma."
      }
      size="lg"
    >
      <motion.div variants={listVariants} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={itemVariants} className="flex items-center gap-3">
          <span className="relative grid h-11 w-11 flex-none place-items-center">
            <span
              ref={haloRef}
              aria-hidden
              style={{ opacity: 0 }}
              className={cn(
                "pointer-events-none absolute inset-0 rounded-full",
                theme === "admin" ? "bg-admin-accent/40" : "bg-gold-400/40",
              )}
            />
            <span
              ref={badgeRef}
              className={cn(
                "relative grid h-11 w-11 place-items-center rounded-full ring-1",
                theme === "admin"
                  ? "bg-admin-accent/12 text-admin-accent ring-admin-accent/25"
                  : "bg-navy-900/8 text-navy-900 ring-navy-900/15",
              )}
            >
              <ShieldIcon className="h-5 w-5" />
            </span>
          </span>
          <p className={classes.muted}>Mantenha sua senha forte e exclusiva desta conta.</p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PasswordForm theme={theme} />
        </motion.div>

        <motion.p variants={itemVariants} className={classes.muted}>
          Exportação e exclusão de dados pessoais ficam em{" "}
          <Link
            href={dataHref}
            onClick={onClose}
            className={cn("font-medium underline", theme === "app" && "text-navy-900")}
          >
            Meus dados
          </Link>
          .
        </motion.p>
      </motion.div>
    </Dialog>
  );
}
