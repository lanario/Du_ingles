"use client";

/**
 * Formulário da aula experimental — o ponto de conversão da landing.
 *
 * São só cinco campos, e quatro deles obrigatórios, então o desenho aposta em
 * feedback em vez de etapas: cada campo preenchido acende um trecho da barra
 * dourada no topo do cartão, e o botão só ganha o brilho de "pronto" quando os
 * quatro estão completos. Menos formulário, mais progresso visível.
 *
 * Divisão das duas bibliotecas de animação, como no resto do projeto:
 *
 * - GSAP cuida do que é desenho contínuo e não passa pelo React — entrada por
 *   rolagem, a barra de progresso, os halos que respiram no fundo, o tremor de
 *   erro e o traço do "check" da confirmação.
 * - Framer Motion cuida do que é ciclo de vida de componente — rótulos
 *   flutuantes, a pílula que desliza entre "Sim"/"Não" (layoutId), o aviso
 *   condicional do menor de idade e a troca formulário → confirmação.
 *
 * As duas nunca animam o mesmo nó, e ambas respeitam `prefers-reduced-motion`.
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createTrialLeadAction } from "@/actions/leads/create-trial-lead";
import {
  CheckIcon,
  ClockIcon,
  MailIcon,
  MessageIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { LogoLoader } from "@/components/ui/logo-loader";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const EASE = [0.22, 1, 0.36, 1] as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Máscara BR progressiva: (11) 91234-5678. Fixo para de crescer em 10 dígitos. */
function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ---------------------------------------------------------------------------
// Campo com rótulo flutuante
// ---------------------------------------------------------------------------

interface FieldProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: React.ReactNode;
  type?: string;
  inputMode?: "text" | "email" | "tel";
  autoComplete?: string;
  optional?: boolean;
  multiline?: boolean;
  hint?: string;
  error?: string;
}

function Field({
  name,
  label,
  value,
  onChange,
  icon,
  type = "text",
  inputMode,
  autoComplete,
  optional = false,
  multiline = false,
  hint,
  error,
}: FieldProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const reduceMotion = useReducedMotion();
  const raised = focused || value.length > 0;

  const shared = {
    id,
    name,
    value,
    autoComplete,
    inputMode,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-message` : hint ? `${id}-message` : undefined,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    className: cn(
      // 16px é o piso do campo: abaixo disso o Safari do iOS dá zoom ao focar
      // e a página fica deslocada até o usuário pinçar de volta.
      "w-full bg-transparent text-base text-white caret-gold-400 outline-none",
      multiline ? "min-h-24 resize-none pb-3 pt-8" : "h-14 pt-5",
    ),
  };

  return (
    <div data-field>
      <div
        className={cn(
          "relative rounded-2xl border px-11 backdrop-blur-sm transition-colors duration-300",
          "bg-white/[0.04]",
          error
            ? "border-destructive/70"
            : focused
              ? "border-gold-400"
              : "border-white/15 hover:border-white/30",
        )}
      >
        {/* Ícone: apaga quando o campo está vazio e sem foco. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-4 flex items-center transition-colors duration-300",
            multiline ? "top-6" : "top-1/2 -translate-y-1/2",
            focused ? "text-gold-400" : value ? "text-white/70" : "text-white/35",
          )}
        >
          {icon}
        </span>

        <motion.label
          htmlFor={id}
          initial={false}
          animate={reduceMotion ? {} : { y: raised ? -11 : 0, scale: raised ? 0.8 : 1 }}
          transition={{ duration: 0.22, ease: EASE }}
          className={cn(
            "pointer-events-none absolute left-11 origin-left text-base transition-colors duration-300",
            multiline ? "top-6" : "top-1/2 -translate-y-1/2",
            error ? "text-red-300" : focused ? "text-gold-300" : "text-white/55",
          )}
        >
          {label}
          {optional && <span className="ml-1.5 text-xs text-white/35">(opcional)</span>}
        </motion.label>

        {multiline ? (
          <textarea
            {...shared}
            rows={3}
            maxLength={2000}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            {...shared}
            type={type}
            maxLength={120}
            onChange={(event) => onChange(event.target.value)}
          />
        )}

        {/* Traço dourado que cresce do centro quando o campo recebe foco. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-4 bottom-0 h-px origin-center scale-x-0 bg-gold-400",
            "transition-transform duration-300 ease-out",
            focused && "scale-x-100",
          )}
        />
      </div>

      <AnimatePresence initial={false} mode="wait">
        {(error ?? hint) && (
          <motion.p
            key={error ?? hint}
            id={`${id}-message`}
            role={error ? "alert" : undefined}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: EASE }}
            className={cn(
              "mt-1.5 px-1 text-xs",
              error ? "text-red-300" : "text-white/40",
            )}
          >
            {error ?? hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Maioridade (Sim/Não)
// ---------------------------------------------------------------------------

function AgeChoice({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: "sim" | "nao") => void;
  error?: string;
}) {
  const groupId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <div data-field>
      {/* O valor viaja para a Server Action por aqui — os botões são de UI. */}
      <input type="hidden" name="isAdult" value={value} />

      <div
        role="radiogroup"
        aria-labelledby={groupId}
        className={cn(
          "rounded-2xl border p-4 backdrop-blur-sm transition-colors duration-300",
          "bg-white/[0.04]",
          error ? "border-destructive/70" : "border-white/15",
        )}
      >
        <p id={groupId} className="text-base font-medium text-white">
          Você tem 18 anos ou mais?
        </p>
        <p className="mt-1 text-xs text-white/45">
          Para menores de idade, a matrícula é combinada com o responsável.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["sim", "nao"] as const).map((option) => {
            const active = value === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(option)}
                className={cn(
                  "relative isolate flex min-h-12 items-center justify-center rounded-xl px-2 text-center",
                  "text-[13px] font-semibold leading-tight transition-colors duration-200 sm:text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400",
                  "focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
                  active ? "text-navy-950" : "text-white/70 hover:text-white",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="trial-age-pill"
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-xl bg-gold-500 shadow-[0_0_24px_rgba(201,162,39,0.45)]"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 34 }
                    }
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-xl border border-white/15 bg-white/[0.03]"
                  />
                )}
                {option === "sim" ? "Sim, sou maior" : "Não, sou menor"}
              </button>
            );
          })}
        </div>

        <AnimatePresence initial={false}>
          {value === "nao" && (
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: EASE }}
              className="overflow-hidden"
            >
              <p className="mt-3 text-xs leading-relaxed text-gold-200">
                Sem problema — vamos pedir o contato do seu responsável antes de confirmar
                o horário.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            role="alert"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="mt-1.5 px-1 text-xs text-red-300"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmação
// ---------------------------------------------------------------------------

function SuccessPanel({ name }: { name: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reduceMotion = useReducedMotion();
  const firstName = name.trim().split(/\s+/)[0] ?? "";

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || prefersReducedMotion()) return;

    // O anel entra girando e o "check" é desenhado depois — a ordem é o que
    // faz a marca parecer escrita, em vez de aparecer pronta.
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .from("[data-ring]", {
          scale: 0.5,
          opacity: 0,
          rotate: -90,
          transformOrigin: "center",
          duration: 0.55,
          ease: "back.out(2)",
        })
        .fromTo(
          "[data-check]",
          { strokeDashoffset: 44 },
          { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" },
          "-=0.15",
        );
    }, svg);

    return () => ctx.revert();
  }, [reduceMotion]);

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="relative flex flex-col items-center px-2 py-12 text-center"
    >
      <svg ref={svgRef} viewBox="0 0 64 64" fill="none" aria-hidden className="h-16 w-16">
        <circle
          data-ring
          cx="32"
          cy="32"
          r="29"
          stroke="var(--gold-500)"
          strokeWidth="2"
        />
        <path
          data-check
          d="M20 33.5 L28.5 42 L44 25"
          stroke="var(--gold-400)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="44"
        />
      </svg>

      <h3 className="mt-6 text-2xl font-bold text-white">
        {firstName ? `Pedido enviado, ${firstName}!` : "Pedido enviado!"}
      </h3>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
        Nossa coordenação entra em contato pelo telefone informado para escolher o melhor
        horário da sua aula experimental — sem custo e sem compromisso.
      </p>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs text-white/60">
        <ClockIcon className="h-3.5 w-3.5 text-gold-400" />
        Resposta em até 24 horas úteis
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------

export function TrialClassForm() {
  const [state, formAction, isPending] = useActionState(createTrialLeadAction, null);
  const reduceMotion = useReducedMotion();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isAdult, setIsAdult] = useState("");
  const [goal, setGoal] = useState("");

  const cardRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  const fieldErrors = state && !state.success ? state.error.fields : undefined;
  const bannerError =
    state && !state.success && !state.error.fields ? state.error.message : undefined;

  // Progresso: só os quatro obrigatórios contam — o objetivo é opcional e
  // marcá-lo como pendente daria a impressão errada de formulário incompleto.
  const filled = [
    name.trim().includes(" "),
    /.+@.+\..+/.test(email),
    phone.replace(/\D/g, "").length >= 10,
    isAdult !== "",
  ].filter(Boolean).length;
  const ready = filled === 4;

  // Entrada por rolagem: o cartão sobe, os campos entram escalonados e os
  // halos do fundo começam a respirar.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from(card, {
        y: 48,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: card, start: "top 88%", once: true },
      });
      gsap.from("[data-field]", {
        y: 18,
        opacity: 0,
        duration: 0.5,
        stagger: 0.07,
        ease: "power2.out",
        scrollTrigger: { trigger: card, start: "top 80%", once: true },
      });
      gsap.to("[data-glow]", {
        xPercent: "random(-12, 12)",
        yPercent: "random(-14, 14)",
        scale: "random(0.9, 1.15)",
        duration: 9,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 1.5,
      });
    }, card);

    return () => ctx.revert();
  }, []);

  // Barra de progresso: tween contínuo, fora do ciclo de render do React.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const ratio = filled / 4;
    if (prefersReducedMotion()) {
      gsap.set(bar, { scaleX: ratio });
      return;
    }
    const tween = gsap.to(bar, {
      scaleX: ratio,
      duration: 0.6,
      ease: "power3.out",
      overwrite: "auto",
    });
    return () => {
      tween.kill();
    };
  }, [filled]);

  // Erro vindo do servidor: um tremor curto leva o olho de volta ao cartão.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || !state || state.success || prefersReducedMotion()) return;
    const tween = gsap.fromTo(
      card,
      { x: -8 },
      { x: 0, duration: 0.6, ease: "elastic.out(1, 0.35)" },
    );
    return () => {
      tween.kill();
    };
  }, [state]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative overflow-hidden rounded-3xl p-5 sm:rounded-[28px] sm:p-8",
        "bg-[linear-gradient(160deg,var(--navy-900)_0%,var(--navy-950)_55%,#03091a_100%)]",
        "shadow-[0_30px_80px_-30px_rgba(5,15,34,0.75)] ring-1 ring-white/10",
      )}
    >
      {/* Halos decorativos — atmosfera, sem semântica. */}
      <span
        data-glow
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold-500/20 blur-[80px]"
      />
      <span
        data-glow
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-navy-500/25 blur-[90px]"
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-300">
            <ShieldIcon className="h-3.5 w-3.5" />
            Aula experimental gratuita
          </span>
          <span className="text-xs tabular-nums text-white/40">
            {state?.success ? "concluído" : `${filled}/4`}
          </span>
        </div>

        <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
          <span
            ref={barRef}
            aria-hidden
            // A escala inicial vem do `style` e não de uma classe: o utilitário
            // `scale-x-0` do Tailwind escreve a propriedade CSS `scale`, que
            // compõe depois do `transform` do GSAP e deixaria a barra achatada
            // em zero para sempre.
            style={{ transform: "scaleX(0)" }}
            className="block h-full w-full origin-left rounded-full bg-[linear-gradient(90deg,var(--gold-600),var(--gold-400))]"
          />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {state?.success ? (
          <SuccessPanel key="success" name={name} />
        ) : (
          <motion.div
            key="form"
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <div className="relative mt-6">
              <h3 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">
                Agende sua aula experimental
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Uma aula ao vivo com professor certificado, mais o diagnóstico do seu
                nível CEFR. Leva menos de um minuto para pedir.
              </p>
            </div>

            <form action={formAction} noValidate className="relative mt-6 space-y-3.5">
              {bannerError && (
                <motion.p
                  role="alert"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-red-200"
                >
                  {bannerError}
                </motion.p>
              )}

              <Field
                name="name"
                label="Nome completo"
                value={name}
                onChange={setName}
                autoComplete="name"
                icon={<UserIcon className="h-[18px] w-[18px]" />}
                error={fieldErrors?.["name"]?.[0]}
              />

              <Field
                name="email"
                label="E-mail"
                type="email"
                inputMode="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                icon={<MailIcon className="h-[18px] w-[18px]" />}
                error={fieldErrors?.["email"]?.[0]}
              />

              <Field
                name="phone"
                label="Telefone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(value) => setPhone(maskPhone(value))}
                autoComplete="tel"
                icon={<MessageIcon className="h-[18px] w-[18px]" />}
                hint="Usamos este número no WhatsApp para confirmar o horário."
                error={fieldErrors?.["phone"]?.[0]}
              />

              <AgeChoice
                value={isAdult}
                onChange={setIsAdult}
                error={fieldErrors?.["isAdult"]?.[0]}
              />

              <Field
                name="goal"
                label="Objetivo das aulas"
                value={goal}
                onChange={setGoal}
                multiline
                optional
                icon={<MessageIcon className="h-[18px] w-[18px]" />}
                hint="Ex.: entrevistas de trabalho, viagem, intercâmbio, conversação."
                error={fieldErrors?.["goal"]?.[0]}
              />

              <div data-field className="pt-1.5">
                <motion.button
                  type="submit"
                  disabled={isPending}
                  whileHover={reduceMotion || isPending ? undefined : { scale: 1.015 }}
                  whileTap={reduceMotion || isPending ? undefined : { scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className={cn(
                    "relative flex min-h-14 w-full items-center justify-center gap-2.5 px-4 text-center",
                    "overflow-hidden rounded-2xl text-base font-semibold tracking-wide",
                    "transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-70",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400",
                    "focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
                    ready
                      ? "bg-[linear-gradient(100deg,var(--gold-500),var(--gold-300),var(--gold-500))] text-navy-950 shadow-[0_0_32px_-4px_rgba(201,162,39,0.6)]"
                      : "border border-white/15 bg-white/[0.06] text-white/80",
                  )}
                >
                  {isPending ? (
                    <>
                      <LogoLoader size={16} label={null} />
                      Enviando…
                    </>
                  ) : (
                    <>
                      Quero minha aula experimental
                      <CheckIcon
                        aria-hidden
                        className={cn(
                          "h-4 w-4 transition-opacity duration-300",
                          ready ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </>
                  )}
                </motion.button>

                <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">
                  Seus dados são usados apenas para o contato desta solicitação, conforme
                  a LGPD. Nada de spam.
                </p>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
