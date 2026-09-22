"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { registerStudentAction } from "@/actions/auth/register-student";
import {
  REGISTRATION_FOCUS_OPTIONS,
  REGISTRATION_PROFESSION_OPTIONS,
  REGISTRATION_STYLE_OPTIONS,
} from "@/schemas/student-registration";

export interface RegistrationPlan {
  id: string;
  name: string;
  headline: string | null;
  description: string | null;
  features: string[];
  priceCents: number;
  currency: string;
  billingInterval: "month" | "quarter" | "semester" | "year";
  lessonsPerMonth: number | null;
  minutesPerLesson: number | null;
}

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

const STEPS = ["Sobre você", "Seu inglês", "Plano e acesso"];

export function StudentRegistrationWizard({ plans }: { plans: RegistrationPlan[] }) {
  const [state, formAction, isPending] = useActionState(registerStudentAction, null);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      window.location.assign(state.data.url);
      return;
    }
    if (state && !state.success && state.error.fields) {
      const fields = Object.keys(state.error.fields);
      const firstStep = fields.some((field) =>
        [
          "fullName",
          "phone",
          "isAdult",
          "guardianName",
          "guardianPhone",
          "guardianEmail",
        ].includes(field),
      )
        ? 0
        : fields.some((field) =>
              [
                "goal",
                "focusTopics",
                "learningStyles",
                "studySituation",
                "profession",
                "professionOther",
              ].includes(field),
            )
          ? 1
          : 2;
      setStep(firstStep);
    }
  }, [state]);

  const fieldErrors = state && !state.success ? state.error.fields : undefined;

  function set<K extends keyof RegistrationValues>(key: K, value: RegistrationValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function nextStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (step === 0 && !values.isAdult) {
      setLocalError("Informe se você tem 18 anos ou mais.");
      return;
    }
    if (!formRef.current?.reportValidity()) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
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

  const visibleFields =
    step === 0
      ? ["fullName", "phone", "isAdult", "guardianName", "guardianPhone", "guardianEmail"]
      : step === 1
        ? ["goal", "studySituation", "profession", "professionOther"]
        : step === 2
          ? ["email", "password", "confirmPassword", "planId"]
          : [];

  const chosenPlan = plans.find((plan) => plan.id === values.planId);

  return (
    <section className="w-full max-w-3xl overflow-hidden rounded-3xl bg-background shadow-[0_24px_70px_rgba(5,15,34,0.32)]">
      <div className="bg-[linear-gradient(120deg,var(--navy-900),var(--navy-700))] px-6 py-6 text-white sm:px-9">
        <Link
          href="/login"
          className="text-xs font-medium text-white/70 hover:text-white"
        >
          ← Voltar para entrar
        </Link>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Cadastro de aluno
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Vamos encontrar seu jeito de aprender
            </h1>
          </div>
          <span className="shrink-0 text-xs text-white/65">
            {step + 1}/{STEPS.length}
          </span>
        </div>
        <div
          className="mt-5 flex gap-1.5"
          aria-label={`Etapa ${step + 1} de ${STEPS.length}`}
        >
          {STEPS.map((label, index) => (
            <div key={label} className="h-1.5 flex-1 rounded-full bg-white/15">
              <div
                className={`h-full rounded-full bg-accent transition-[width] ${index <= step ? "w-full" : "w-0"}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-white/60">
          {STEPS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={step < STEPS.length - 1 ? nextStep : undefined}
        className="space-y-6 px-6 py-7 sm:px-9 sm:py-8"
      >
        {Object.entries(values).map(([name, value]) => {
          if (
            visibleFields.includes(name) ||
            name === "focusTopics" ||
            name === "learningStyles"
          ) {
            return null;
          }
          if (Array.isArray(value)) {
            return value.map((item) => (
              <input key={`${name}-${item}`} type="hidden" name={name} value={item} />
            ));
          }
          return <input key={name} type="hidden" name={name} value={value} />;
        })}
        {values.focusTopics.map((value) => (
          <input key={`focus-${value}`} type="hidden" name="focusTopics" value={value} />
        ))}
        {values.learningStyles.map((value) => (
          <input
            key={`style-${value}`}
            type="hidden"
            name="learningStyles"
            value={value}
          />
        ))}

        <div className="min-h-[330px]">
          {step === 0 && (
            <div className="space-y-5">
              <StepTitle
                title="Comecemos por você"
                detail="Esses dados ajudam a coordenação a preparar sua primeira aula."
              />
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
              <fieldset>
                <legend className="text-sm font-semibold text-foreground">
                  Você tem 18 anos ou mais?
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ChoiceButton
                    selected={values.isAdult === "yes"}
                    onClick={() => set("isAdult", "yes")}
                  >
                    Sim, sou maior
                  </ChoiceButton>
                  <ChoiceButton
                    selected={values.isAdult === "no"}
                    onClick={() => set("isAdult", "no")}
                  >
                    Não, sou menor
                  </ChoiceButton>
                </div>
                <input type="hidden" name="isAdult" value={values.isAdult} />
                {fieldErrors?.isAdult?.[0] && (
                  <FieldError>{fieldErrors.isAdult[0]}</FieldError>
                )}
              </fieldset>
              {values.isAdult === "no" && (
                <div className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 sm:grid-cols-2">
                  <p className="text-sm leading-relaxed text-muted-foreground sm:col-span-2">
                    Para menores de idade, o responsável legal deve preencher estes dados.
                  </p>
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
                      className={`${INPUT} sm:col-span-2`}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <StepTitle
                title="Como você quer usar o inglês?"
                detail="Conte um pouco sobre seus objetivos e preferências."
              />
              <fieldset>
                <legend className="text-sm font-semibold text-foreground">
                  Qual é sua situação hoje?
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["personal", "Pessoal"],
                    ["work", "Trabalho"],
                    ["study", "Estudos"],
                    ["both", "Trabalho e estudos"],
                  ].map(([value, label]) => (
                    <ChoiceButton
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
                    </ChoiceButton>
                  ))}
                </div>
                <input
                  type="hidden"
                  name="studySituation"
                  value={values.studySituation}
                />
              </fieldset>

              {(values.studySituation === "work" || values.studySituation === "both") && (
                <div className="grid gap-4 sm:grid-cols-2">
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

              <Field
                label="Qual é seu objetivo com as aulas? (opcional)"
                error={fieldErrors?.goal?.[0]}
              >
                <textarea
                  name="goal"
                  value={values.goal}
                  onChange={(event) => set("goal", event.target.value)}
                  className={`${INPUT} min-h-24 resize-y`}
                  maxLength={2000}
                  placeholder="Ex.: entrevistas de trabalho, viagens, intercâmbio, conversação..."
                />
              </Field>

              <ChoiceGroup
                title="Gostaria de focar em algum tópico?"
                choices={REGISTRATION_FOCUS_OPTIONS}
                selected={values.focusTopics}
                onToggle={(value) => toggleChoice("focusTopics", value)}
                error={fieldErrors?.focusTopics?.[0]}
              />
              <ChoiceGroup
                title="Qual estilo de ensino funciona melhor para você?"
                detail="Selecione até 3 características favoritas."
                choices={REGISTRATION_STYLE_OPTIONS}
                selected={values.learningStyles}
                onToggle={(value) => toggleChoice("learningStyles", value, 3)}
                error={fieldErrors?.learningStyles?.[0]}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <StepTitle
                title="Escolha seu plano e crie seu acesso"
                detail="Depois de escolher o plano, informe seu e-mail e sua senha. O cartão será cadastrado com segurança pela Stripe e a primeira cobrança será feita após 7 dias."
              />
              {plans.length === 0 ? (
                <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Não há planos mensais disponíveis para cadastro no momento. Fale com a
                  coordenação.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      aria-pressed={values.planId === plan.id}
                      onClick={() => set("planId", plan.id)}
                      className={`rounded-2xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${values.planId === plan.id ? "border-gold-500 bg-gold-50/70 shadow-sm" : "border-border hover:border-gold-300"}`}
                    >
                      <span className="block text-sm font-semibold text-foreground">
                        {plan.name}
                      </span>
                      {plan.headline && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {plan.headline}
                        </span>
                      )}
                      <span className="mt-3 block text-lg font-bold text-primary">
                        {money(plan.priceCents, plan.currency)}
                        <span className="text-xs font-normal text-muted-foreground">
                          {" "}
                          / {intervalLabel(plan.billingInterval)}
                        </span>
                      </span>
                      <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                        {plan.description ||
                          `${plan.lessonsPerMonth ? `${plan.lessonsPerMonth} aulas por mês` : "Aulas em grupo"}${plan.minutesPerLesson ? ` · ${plan.minutesPerLesson} min por aula` : ""}`}
                      </span>
                      {plan.features.length > 0 && (
                        <span className="mt-3 block space-y-1 text-xs text-foreground/70">
                          {plan.features.slice(0, 4).map((feature) => (
                            <span key={feature} className="block">
                              <span aria-hidden className="mr-2 text-gold-600">
                                ✓
                              </span>
                              {feature}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <input type="hidden" name="planId" value={values.planId} />
              {fieldErrors?.planId?.[0] && (
                <FieldError>{fieldErrors.planId[0]}</FieldError>
              )}
              <p className="rounded-xl bg-navy-50 px-4 py-3 text-xs leading-relaxed text-navy-800">
                Você poderá cancelar a assinatura durante os 7 dias de experiência pela
                aba Planos. Se cancelar dentro desse prazo, não haverá cobrança.
              </p>
              <div className="mt-7 space-y-5 border-t border-border pt-6">
                <h3 className="text-base font-semibold text-foreground">
                  Crie seus dados de acesso
                </h3>
                {chosenPlan && (
                  <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-foreground">
                    Plano escolhido: <strong>{chosenPlan.name}</strong> ·{" "}
                    {money(chosenPlan.priceCents, chosenPlan.currency)} /{" "}
                    {intervalLabel(chosenPlan.billingInterval)}
                  </p>
                )}
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
                  <span className="mt-1 block text-xs text-muted-foreground">
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
                <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                  <input
                    type="checkbox"
                    name="consent"
                    required
                    className="mt-0.5 size-4 shrink-0 accent-[var(--navy-800)]"
                  />
                  <span>
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
                  </span>
                </label>
                {fieldErrors?.consent?.[0] && (
                  <FieldError>{fieldErrors.consent[0]}</FieldError>
                )}
                <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                  <input
                    type="checkbox"
                    name="contactConsent"
                    required
                    className="mt-0.5 size-4 shrink-0 accent-[var(--navy-800)]"
                  />
                  <span>
                    {values.isAdult === "no"
                      ? "Autorizo o contato por e-mail e WhatsApp para combinar a aula experimental e a matrícula do aluno menor."
                      : "Autorizo o contato por e-mail e WhatsApp para combinar minha aula experimental e matrícula. Não enviaremos mensagens promocionais."}
                  </span>
                </label>
                {fieldErrors?.contactConsent?.[0] && (
                  <FieldError>{fieldErrors.contactConsent[0]}</FieldError>
                )}
              </div>
            </div>
          )}
        </div>

        {(localError || (state && !state.success && !state.error.fields)) && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
          >
            {localError ?? (state && !state.success ? state.error.message : "")}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                setStep((current) => current - 1);
              }}
              className="rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Voltar
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Continuar
            </button>
          ) : (
            <button
              type="submit"
              disabled={isPending || plans.length === 0}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
            >
              {isPending ? "Criando sua conta…" : "Criar conta e cadastrar pagamento"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

const INPUT =
  "w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15";

function StepTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-foreground">
      {label}
      {children}
      {error && <FieldError>{error}</FieldError>}
    </label>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs font-normal text-destructive">{children}</span>;
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border text-foreground hover:border-primary/50"}`}
    >
      {children}
    </button>
  );
}

function ChoiceGroup({
  title,
  detail,
  choices,
  selected,
  onToggle,
  error,
}: {
  title: string;
  detail?: string;
  choices: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">{title}</legend>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {choices.map((choice) => (
          <ChoiceButton
            key={choice.value}
            selected={selected.includes(choice.value)}
            onClick={() => onToggle(choice.value)}
          >
            {choice.label}
          </ChoiceButton>
        ))}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </fieldset>
  );
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function intervalLabel(interval: RegistrationPlan["billingInterval"]) {
  return { month: "mês", quarter: "trimestre", semester: "semestre", year: "ano" }[
    interval
  ];
}
