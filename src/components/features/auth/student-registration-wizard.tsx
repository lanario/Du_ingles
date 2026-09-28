"use client";

/**
 * Cadastro público do aluno, no mesmo padrão visual da aba de planos: títulos
 * numerados, cartões de escolha e o construtor "nível → ritmo → compromisso"
 * (o mesmo componente da vitrine, em modo `select`).
 *
 * O cartão ocupa a largura da tela: um painel navy à esquerda com as etapas e
 * o plano escolhido, e o conteúdo à direita em grades que se redistribuem
 * conforme o espaço. A barra de ações fica colada no rodapé da viewport
 * (`sticky`) para nunca sair de vista — por isso o cartão usa `overflow-clip`,
 * que recorta os cantos sem criar um contêiner de rolagem.
 */

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { registerStudentAction } from "@/actions/auth/register-student";
import {
  LoosePlansGrid,
  StepHeader,
  TierBuilder,
} from "@/components/features/plans/plans-showcase";
import {
  ACCENT_TONE,
  FREQUENCY_LABEL,
  INTERVAL_LABEL,
  INTERVAL_SUFFIX,
  TIER_ACCENT,
  TIER_LABEL,
  formatMoney,
  seatsLeft,
  splitMoney,
  type StudentPlan,
} from "@/components/features/admin/plans/plans-utils";
import { ArrowLeftIcon, CheckIcon, ChevronRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  REGISTRATION_FOCUS_OPTIONS,
  REGISTRATION_PROFESSION_OPTIONS,
  REGISTRATION_STYLE_OPTIONS,
} from "@/schemas/student-registration";

interface RegistrationValues {
  fullName: string;
  phone: string;
  isAdult: "yes" | "no" | "";
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  goal: string;
  focusTopics: string[];
  learningStyles: string[];
  studySituation: "work" | "study" | "both" | "personal";
  profession: string;
  professionOther: string;
  planId: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const INITIAL_VALUES: RegistrationValues = {
  fullName: "",
  phone: "",
  isAdult: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
  goal: "",
  focusTopics: [],
  learningStyles: [],
  studySituation: "personal",
  profession: "",
  professionOther: "",
  planId: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const STEPS = [
  {
    label: "Sobre você",
    hint: "Seus dados de contato",
    title: "Comecemos por você",
    detail: "Esses dados ajudam a coordenação a preparar sua primeira aula.",
  },
  {
    label: "Seu inglês",
    hint: "Objetivos e preferências",
    title: "Como você quer usar o inglês?",
    detail: "Conte um pouco sobre seus objetivos e o jeito que você gosta de aprender.",
  },
  {
    label: "Seu plano",
    hint: "Nível, ritmo e compromisso",
    title: "Escolha como você quer aprender inglês",
    detail:
      "Três passos: o nível de acompanhamento, o ritmo das aulas em grupo e o compromisso que faz mais sentido pra você. Você começa com 7 dias de experiência grátis.",
  },
  {
    label: "Seu acesso",
    hint: "E-mail, senha e pagamento",
    title: "Crie seus dados de acesso",
    detail:
      "O cartão é cadastrado com segurança pela Stripe e a primeira cobrança só acontece após os 7 dias de experiência.",
  },
] as const;

const LAST_STEP = STEPS.length - 1;

/** Campos de cada etapa — usado para levar o aluno à etapa do erro do servidor. */
const STEP_FIELDS: readonly (readonly string[])[] = [
  ["fullName", "phone", "isAdult", "guardianName", "guardianPhone", "guardianEmail"],
  ["goal", "focusTopics", "learningStyles", "studySituation", "profession", "professionOther"],
  ["planId"],
  ["email", "password", "confirmPassword", "consent", "contactConsent"],
];

/** Campos digitados na etapa atual. Os demais viajam como `hidden`. */
const VISIBLE_FIELDS: readonly (readonly string[])[] = [
  ["fullName", "phone", "isAdult", "guardianName", "guardianPhone", "guardianEmail"],
  ["goal", "studySituation", "profession", "professionOther"],
  [],
  ["email", "password", "confirmPassword"],
];

export function StudentRegistrationWizard({ plans }: { plans: StudentPlan[] }) {
  const [state, formAction, isPending] = useActionState(registerStudentAction, null);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [consents, setConsents] = useState({ terms: false, contact: false });
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.success) {
      window.location.assign(state.data.url);
      return;
    }
    if (state && !state.success && state.error.fields) {
      const fields = Object.keys(state.error.fields);
      const target = STEP_FIELDS.findIndex((list) =>
        fields.some((field) => list.includes(field)),
      );
      setStep(target === -1 ? LAST_STEP : target);
    }
  }, [state]);

  const fieldErrors = state && !state.success ? state.error.fields : undefined;

  const tierPlans = plans.filter((plan) => plan.tier !== null);
  const loosePlans = plans.filter((plan) => plan.tier === null);
  const chosenPlan = plans.find((plan) => plan.id === values.planId) ?? null;

  function set<K extends keyof RegistrationValues>(key: K, value: RegistrationValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function goTo(next: number) {
    setLocalError(null);
    setStep(next);
    // O cartão é alto: sem isso, voltar/avançar mantém a rolagem no rodapé da
    // etapa anterior e a nova etapa começa "no meio".
    contentRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function nextStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (step === 0 && !values.isAdult) {
      setLocalError("Informe se você tem 18 anos ou mais.");
      return;
    }
    if (step === 2 && !chosenPlan) {
      setLocalError("Escolha um plano para continuar.");
      return;
    }
    if (!formRef.current?.reportValidity()) return;
    goTo(Math.min(step + 1, LAST_STEP));
  }

  function toggleChoice(
    field: "focusTopics" | "learningStyles",
    value: string,
    limit?: number,
  ) {
    setValues((current) => {
      const selected = current[field];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : value === "none"
          ? [value]
          : [...selected.filter((item) => item !== "none"), value];
      return { ...current, [field]: limit ? next.slice(-limit) : next };
    });
  }

  const visibleFields = VISIBLE_FIELDS[step] ?? [];
  const current = STEPS[step] ?? STEPS[0];
  const serverMessage = state && !state.success && !state.error.fields ? state.error.message : "";

  return (
    <section className="grid w-full max-w-7xl overflow-clip rounded-3xl bg-background shadow-[0_24px_70px_rgba(5,15,34,0.32)] lg:min-h-[calc(100dvh-11rem)] lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]">
      <Sidebar
        step={step}
        chosenPlan={chosenPlan}
        onStepClick={(index) => index < step && goTo(index)}
      />

      <form
        ref={formRef}
        action={formAction}
        onSubmit={step < LAST_STEP ? nextStep : undefined}
        className="bg-app-canvas flex min-w-0 flex-col"
      >
        {Object.entries(values).map(([name, value]) => {
          if (visibleFields.includes(name) || name === "focusTopics" || name === "learningStyles") {
            return null;
          }
          return <input key={name} type="hidden" name={name} value={value as string} />;
        })}
        {values.focusTopics.map((value) => (
          <input key={`focus-${value}`} type="hidden" name="focusTopics" value={value} />
        ))}
        {values.learningStyles.map((value) => (
          <input key={`style-${value}`} type="hidden" name="learningStyles" value={value} />
        ))}

        <div ref={contentRef} className="flex-1 scroll-mt-4 px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
          <header className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-600">
              Etapa {step + 1} de {STEPS.length}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              {current.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {current.detail}
            </p>
          </header>

          {step === 0 && (
            <div className="mt-8 space-y-9">
              <section className="space-y-4">
                <StepHeader
                  index={1}
                  title="Seus dados"
                  subtitle="Como a coordenação fala com você."
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome completo" error={fieldErrors?.fullName?.[0]}>
                    <input
                      name="fullName"
                      autoComplete="name"
                      required
                      value={values.fullName}
                      onChange={(event) => set("fullName", event.target.value)}
                      className={INPUT}
                      placeholder="Seu nome e sobrenome"
                    />
                  </Field>
                  <Field label="Telefone / WhatsApp" error={fieldErrors?.phone?.[0]}>
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      value={values.phone}
                      onChange={(event) => set("phone", event.target.value)}
                      className={INPUT}
                      placeholder="(11) 99999-9999"
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-4">
                <StepHeader
                  index={2}
                  title="Sua idade"
                  subtitle="Para menores de idade, o responsável legal preenche os dados."
                />
                <fieldset>
                  <legend className="sr-only">Você tem 18 anos ou mais?</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Choice
                      selected={values.isAdult === "yes"}
                      onClick={() => set("isAdult", "yes")}
                    >
                      Sim, tenho 18 anos ou mais
                    </Choice>
                    <Choice
                      selected={values.isAdult === "no"}
                      onClick={() => set("isAdult", "no")}
                    >
                      Não, sou menor de idade
                    </Choice>
                  </div>
                  <input type="hidden" name="isAdult" value={values.isAdult} />
                  {fieldErrors?.isAdult?.[0] && (
                    <FieldError>{fieldErrors.isAdult[0]}</FieldError>
                  )}
                </fieldset>

                {values.isAdult === "no" && (
                  <div className="grid gap-4 rounded-2xl border border-border bg-background/70 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
                    <Field
                      label="Nome do responsável"
                      error={fieldErrors?.guardianName?.[0]}
                    >
                      <input
                        name="guardianName"
                        autoComplete="name"
                        required
                        value={values.guardianName}
                        onChange={(event) => set("guardianName", event.target.value)}
                        className={INPUT}
                      />
                    </Field>
                    <Field
                      label="Telefone do responsável"
                      error={fieldErrors?.guardianPhone?.[0]}
                    >
                      <input
                        name="guardianPhone"
                        type="tel"
                        autoComplete="tel"
                        required
                        value={values.guardianPhone}
                        onChange={(event) => set("guardianPhone", event.target.value)}
                        className={INPUT}
                      />
                    </Field>
                    <Field
                      label="E-mail do responsável (opcional)"
                      error={fieldErrors?.guardianEmail?.[0]}
                    >
                      <input
                        name="guardianEmail"
                        type="email"
                        autoComplete="email"
                        value={values.guardianEmail}
                        onChange={(event) => set("guardianEmail", event.target.value)}
                        className={INPUT}
                      />
                    </Field>
                  </div>
                )}
              </section>
            </div>
          )}

          {step === 1 && (
            <div className="mt-8 space-y-9">
              <section className="space-y-4">
                <StepHeader
                  index={1}
                  title="Sua situação"
                  subtitle="Onde o inglês entra na sua vida hoje."
                />
                <fieldset>
                  <legend className="sr-only">Qual é sua situação hoje?</legend>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ["personal", "Pessoal"],
                      ["work", "Trabalho"],
                      ["study", "Estudos"],
                      ["both", "Trabalho e estudos"],
                    ].map(([value, label]) => (
                      <Choice
                        key={value}
                        selected={values.studySituation === value}
                        onClick={() =>
                          set(
                            "studySituation",
                            value as RegistrationValues["studySituation"],
                          )
                        }
                      >
                        {label}
                      </Choice>
                    ))}
                  </div>
                  <input
                    type="hidden"
                    name="studySituation"
                    value={values.studySituation}
                  />
                </fieldset>

                {(values.studySituation === "work" || values.studySituation === "both") && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Sua área de trabalho"
                      error={fieldErrors?.profession?.[0]}
                    >
                      <select
                        name="profession"
                        value={values.profession}
                        onChange={(event) => set("profession", event.target.value)}
                        className={INPUT}
                        required
                      >
                        <option value="">Selecione uma opção</option>
                        {REGISTRATION_PROFESSION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {values.profession === "other" && (
                      <Field
                        label="Qual é sua profissão?"
                        error={fieldErrors?.professionOther?.[0]}
                      >
                        <input
                          name="professionOther"
                          value={values.professionOther}
                          onChange={(event) => set("professionOther", event.target.value)}
                          className={INPUT}
                          required
                          placeholder="Escreva sua profissão"
                        />
                      </Field>
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <StepHeader
                  index={2}
                  title="Seu objetivo"
                  subtitle="Opcional, mas ajuda a preparar a primeira aula."
                />
                <Field
                  label="Qual é seu objetivo com as aulas?"
                  error={fieldErrors?.goal?.[0]}
                >
                  <textarea
                    name="goal"
                    value={values.goal}
                    onChange={(event) => set("goal", event.target.value)}
                    className={`${INPUT} min-h-28 resize-y`}
                    maxLength={2000}
                    placeholder="Ex.: entrevistas de trabalho, viagens, intercâmbio, conversação..."
                  />
                </Field>
              </section>

              <div className="grid gap-9 xl:grid-cols-2">
                <ChoiceSection
                  index={3}
                  title="Seus tópicos"
                  subtitle="Gostaria de focar em algum tópico?"
                  choices={REGISTRATION_FOCUS_OPTIONS}
                  selected={values.focusTopics}
                  onToggle={(value) => toggleChoice("focusTopics", value)}
                  error={fieldErrors?.focusTopics?.[0]}
                />
                <ChoiceSection
                  index={4}
                  title="Seu estilo"
                  subtitle="Qual estilo de ensino funciona melhor? Escolha até 3."
                  choices={REGISTRATION_STYLE_OPTIONS}
                  selected={values.learningStyles}
                  onToggle={(value) => toggleChoice("learningStyles", value, 3)}
                  error={fieldErrors?.learningStyles?.[0]}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="pb-2">
              {plans.length === 0 ? (
                <p className="mt-8 rounded-2xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
                  Não há planos mensais disponíveis para cadastro no momento. Fale com a
                  coordenação.
                </p>
              ) : (
                <>
                  {tierPlans.length > 0 && (
                    <TierBuilder
                      plans={tierPlans}
                      mode="select"
                      initialPlanId={values.planId}
                      currentPlanId={values.planId}
                      onSubscribe={(plan) => set("planId", plan.id)}
                    />
                  )}
                  {loosePlans.length > 0 && (
                    <LoosePlansGrid
                      plans={loosePlans}
                      mode="select"
                      currentPlanId={values.planId}
                      onSubscribe={(plan) => set("planId", plan.id)}
                    />
                  )}
                </>
              )}
              {fieldErrors?.planId?.[0] && <FieldError>{fieldErrors.planId[0]}</FieldError>}
            </div>
          )}

          {step === 3 && (
            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="space-y-9">
                <section className="space-y-4">
                  <StepHeader
                    index={1}
                    title="Seu acesso"
                    subtitle="Com esses dados você entra na plataforma."
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Field label="E-mail" error={fieldErrors?.email?.[0]}>
                        <input
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={values.email}
                          onChange={(event) => set("email", event.target.value)}
                          className={INPUT}
                          placeholder="voce@exemplo.com"
                        />
                      </Field>
                    </div>
                    <Field label="Senha" error={fieldErrors?.password?.[0]}>
                      <input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={72}
                        value={values.password}
                        onChange={(event) => set("password", event.target.value)}
                        className={INPUT}
                      />
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Mínimo de 8 caracteres, com maiúscula, minúscula e número.
                      </span>
                    </Field>
                    <Field
                      label="Confirme sua senha"
                      error={fieldErrors?.confirmPassword?.[0]}
                    >
                      <input
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={values.confirmPassword}
                        onChange={(event) => set("confirmPassword", event.target.value)}
                        className={INPUT}
                      />
                    </Field>
                  </div>
                </section>

                <section className="space-y-4">
                  <StepHeader
                    index={2}
                    title="Autorizações"
                    subtitle="Precisamos das duas para criar sua conta."
                  />
                  <div className="space-y-3">
                    <ConsentBox
                      name="consent"
                      checked={consents.terms}
                      onChange={(checked) => setConsents((c) => ({ ...c, terms: checked }))}
                      error={fieldErrors?.consent?.[0]}
                    >
                      Li e aceito os{" "}
                      <Link
                        href="/termos"
                        target="_blank"
                        className="font-medium text-primary underline"
                      >
                        termos de uso
                      </Link>{" "}
                      e a{" "}
                      <Link
                        href="/privacidade"
                        target="_blank"
                        className="font-medium text-primary underline"
                      >
                        política de privacidade
                      </Link>
                      .
                      {values.isAdult === "no" &&
                        " Sou responsável legal pelo aluno menor de idade."}
                    </ConsentBox>
                    <ConsentBox
                      name="contactConsent"
                      checked={consents.contact}
                      onChange={(checked) =>
                        setConsents((c) => ({ ...c, contact: checked }))
                      }
                      error={fieldErrors?.contactConsent?.[0]}
                    >
                      {values.isAdult === "no"
                        ? "Autorizo o contato por e-mail e WhatsApp para combinar a aula experimental e a matrícula do aluno menor."
                        : "Autorizo o contato por e-mail e WhatsApp para combinar minha aula experimental e matrícula. Não enviaremos mensagens promocionais."}
                    </ConsentBox>
                  </div>
                </section>
              </div>

              <PlanSummary plan={chosenPlan} onChange={() => goTo(2)} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 border-t border-border bg-background/92 px-5 py-4 backdrop-blur sm:px-8 lg:px-10">
          {(localError || serverMessage) && (
            <p
              role="alert"
              className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
            >
              {localError ?? serverMessage}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => goTo(step - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Voltar
              </button>
            ) : (
              <span />
            )}
            {step < LAST_STEP ? (
              <button
                type="submit"
                disabled={step === 2 && plans.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
              >
                Continuar
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isPending || !chosenPlan || seatsLeft(chosenPlan) === 0}
                className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
              >
                {isPending ? "Criando sua conta…" : "Criar conta e cadastrar pagamento"}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Painel lateral: etapas + plano escolhido
// ---------------------------------------------------------------------------

function Sidebar({
  step,
  chosenPlan,
  onStepClick,
}: {
  step: number;
  chosenPlan: StudentPlan | null;
  onStepClick: (index: number) => void;
}) {
  return (
    <aside className="flex flex-col gap-5 bg-[linear-gradient(168deg,var(--navy-950)_0%,var(--navy-900)_45%,var(--navy-800)_100%)] px-5 py-6 text-white sm:px-8 lg:gap-8 lg:px-8 lg:py-10">
      <Link
        href="/login"
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-white/70 transition-colors hover:text-white"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Voltar para entrar
      </Link>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          Cadastro de aluno
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-tight lg:text-[28px]">
          Vamos encontrar seu jeito de aprender
        </h1>
        <p
          className="mt-3 hidden text-[13px] leading-relaxed lg:block"
          style={{ color: "var(--navy-300)" }}
        >
          Quatro passos rápidos: você conta um pouco sobre você, escolhe o plano e cria o
          acesso. A primeira cobrança só vem depois de 7 dias.
        </p>
      </div>

      {/* Celular e tablet: barra de progresso compacta. */}
      <div className="lg:hidden" aria-label={`Etapa ${step + 1} de ${STEPS.length}`}>
        <div className="flex gap-1.5">
          {STEPS.map((item, index) => (
            <div key={item.label} className="h-1.5 flex-1 rounded-full bg-white/15">
              <div
                className={cn(
                  "h-full rounded-full bg-accent transition-[width]",
                  index <= step ? "w-full" : "w-0",
                )}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/70">
          {step + 1}/{STEPS.length} · {STEPS[step]?.label}
        </p>
      </div>

      {/* Desktop: lista vertical de etapas. */}
      <ol className="hidden flex-col gap-1 lg:flex">
        {STEPS.map((item, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={item.label}>
              <button
                type="button"
                disabled={!done}
                onClick={() => onStepClick(index)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  active ? "bg-white/10" : done ? "hover:bg-white/5" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold",
                    active
                      ? "border-transparent bg-accent text-navy-950"
                      : done
                        ? "border-accent/60 text-accent"
                        : "border-white/20 text-white/50",
                  )}
                >
                  {done ? <CheckIcon className="h-4 w-4" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      active || done ? "text-white" : "text-white/60",
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="block truncate text-[11px] text-white/55">
                    {item.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {chosenPlan && (
        <div
          className="mt-auto hidden rounded-2xl p-4 lg:block"
          style={{
            background: "color-mix(in srgb, var(--navy-600) 22%, transparent)",
            boxShadow:
              "inset 0 0 0 1px color-mix(in srgb, var(--navy-500) 32%, transparent)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
            Seu plano
          </p>
          <p className="mt-1 text-sm font-semibold">{planTitle(chosenPlan)}</p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--navy-300)" }}>
            {formatMoney(chosenPlan.priceCents, chosenPlan.currency)}
            {INTERVAL_SUFFIX[chosenPlan.billingInterval]}
          </p>
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Resumo do plano na etapa de acesso
// ---------------------------------------------------------------------------

function planTitle(plan: StudentPlan) {
  return plan.tier && plan.weeklyFrequency
    ? `${TIER_LABEL[plan.tier]} · ${FREQUENCY_LABEL[plan.weeklyFrequency]}`
    : plan.name;
}

function PlanSummary({
  plan,
  onChange,
}: {
  plan: StudentPlan | null;
  onChange: () => void;
}) {
  if (!plan) {
    return (
      <div className="self-start rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
        Você ainda não escolheu um plano.{" "}
        <button type="button" onClick={onChange} className="font-medium text-primary underline">
          Escolher agora
        </button>
      </div>
    );
  }

  const tone = ACCENT_TONE[plan.tier ? TIER_ACCENT[plan.tier] : plan.accent];
  const { symbol, whole, fraction } = splitMoney(plan.priceCents);

  return (
    <article
      className="relative flex flex-col self-start overflow-hidden rounded-2xl p-6 lg:sticky lg:top-6"
      style={{
        background:
          "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 40%, var(--navy-800) 100%)",
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 32%, transparent), 0 26px 60px -20px rgba(5,15,34,0.7)`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
      />
      <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: tone }}>
        Plano escolhido
      </p>
      <h3 className="mt-1 text-xl font-bold text-white">{planTitle(plan)}</h3>
      <p className="mt-1 text-[13px]" style={{ color: "var(--navy-300)" }}>
        {INTERVAL_LABEL[plan.billingInterval]}
      </p>

      <p className="mt-4 flex items-baseline gap-1 leading-none">
        <span className="text-sm font-medium" style={{ color: "var(--navy-300)" }}>
          {symbol}
        </span>
        <span className="tabular text-[40px] font-bold tracking-tight text-white">
          {whole}
        </span>
        <span className="tabular text-lg font-semibold" style={{ color: "var(--navy-300)" }}>
          ,{fraction}
        </span>
        <span className="text-sm font-medium" style={{ color: "var(--navy-300)" }}>
          {INTERVAL_SUFFIX[plan.billingInterval]}
        </span>
      </p>

      {plan.features.length > 0 && (
        <>
          <div
            className="my-5 h-px w-full"
            style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)` }}
          />
          <ul className="space-y-2.5">
            {plan.features.slice(0, 6).map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[13px] leading-snug">
                <CheckIcon
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0"
                  strokeWidth={2.4}
                  style={{ color: "var(--gold-400)" }}
                />
                <span className="min-w-0 font-medium text-white/80">{feature}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p
        className="mt-5 rounded-xl px-3.5 py-3 text-[12px] leading-relaxed"
        style={{
          background: "color-mix(in srgb, var(--navy-600) 28%, transparent)",
          color: "var(--navy-300)",
        }}
      >
        7 dias de experiência grátis. Se cancelar nesse prazo pela aba Planos, não há
        cobrança.
      </p>

      <button
        type="button"
        onClick={onChange}
        className="mt-4 self-start text-[13px] font-medium text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
      >
        Trocar plano
      </button>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Peças de formulário
// ---------------------------------------------------------------------------

const INPUT =
  "w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-foreground">
      {label}
      {children}
      {error && <FieldError>{error}</FieldError>}
    </label>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-xs font-normal text-destructive">{children}</span>;
}

/** Cartão de escolha — mesma linguagem dos cartões de ritmo e compromisso. */
function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-12 items-center justify-between gap-2.5 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        selected
          ? "border-gold-500 bg-gold-50/60 font-semibold text-foreground"
          : "border-border bg-background text-foreground hover:border-gold-300",
      )}
    >
      <span>{children}</span>
      {selected && (
        <CheckIcon
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: "var(--gold-600)" }}
          strokeWidth={3}
        />
      )}
    </button>
  );
}

function ChoiceSection({
  index,
  title,
  subtitle,
  choices,
  selected,
  onToggle,
  error,
}: {
  index: number;
  title: string;
  subtitle: string;
  choices: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  error?: string;
}) {
  return (
    <section className="space-y-4">
      <StepHeader index={index} title={title} subtitle={subtitle} />
      <fieldset>
        <legend className="sr-only">{title}</legend>
        <div className="flex flex-wrap gap-2.5">
          {choices.map((choice) => (
            <Choice
              key={choice.value}
              selected={selected.includes(choice.value)}
              onClick={() => onToggle(choice.value)}
            >
              {choice.label}
            </Choice>
          ))}
        </div>
        {error && <FieldError>{error}</FieldError>}
      </fieldset>
    </section>
  );
}

function ConsentBox({
  name,
  checked,
  onChange,
  error,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-[13px] leading-relaxed transition-colors",
          checked
            ? "border-gold-500 bg-gold-50/60 text-foreground"
            : "border-border bg-background text-muted-foreground hover:border-gold-300",
        )}
      >
        <input
          type="checkbox"
          name={name}
          required
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--navy-800)]"
        />
        <span>{children}</span>
      </label>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
