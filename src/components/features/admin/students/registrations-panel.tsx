"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import type { GroupListItem } from "@/repositories/groups";
import type { StudentRegistration } from "@/repositories/student-registrations";
import type { Student } from "./students-utils";

const FOCUS_LABELS: Record<string, string> = {
  none: "Nenhuma preferência",
  business: "Inglês para Negócios",
  conversation: "Conversação em Inglês",
  intensive: "Inglês Intensivo",
  beginners: "Inglês para Iniciantes",
  american: "Inglês Americano",
};
const STYLE_LABELS: Record<string, string> = {
  flexible: "Flexível",
  accessible: "Acessível",
  motivating: "Motiva os alunos",
  immersive: "Envolvente",
  goal_focused: "Foco em metas",
  patient: "Paciente",
  organized: "Boa organização",
  none: "Nenhuma preferência",
};
const PROFESSION_LABELS: Record<string, string> = {
  administration: "Administração e gestão",
  technology: "Tecnologia",
  health: "Saúde",
  education: "Educação",
  sales: "Vendas e atendimento",
  finance: "Finanças e contabilidade",
  engineering: "Engenharia e indústria",
  law: "Direito",
  marketing: "Marketing e comunicação",
  hospitality: "Turismo e hotelaria",
  other: "Outro",
};
const SITUATION_LABELS: Record<string, string> = {
  personal: "Interesse pessoal",
  work: "Trabalho",
  study: "Estudos",
  both: "Trabalho e estudos",
};

interface RegistrationsPanelProps {
  registrations: StudentRegistration[];
  students: Student[];
  groups: GroupListItem[];
  onAssign: (student: Student) => void;
}

export function RegistrationsPanel({
  registrations,
  students,
  groups,
  onAssign,
}: RegistrationsPanelProps) {
  const [search, setSearch] = useState("");
  const studentById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students],
  );
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visible = registrations.filter(
    (registration) =>
      !term ||
      [
        registration.fullName,
        registration.email,
        registration.phone ?? "",
        registration.requestedPlanName ?? "",
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(term)),
  );

  return (
    <section className="mt-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-admin-foreground">Novos cadastros</h2>
          <p className="mt-1 text-sm text-admin-foreground/55">
            Respostas do aluno, plano escolhido e estado do pagamento.
          </p>
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-foreground/40" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar nome, e-mail ou plano"
            aria-label="Buscar cadastro"
            className="w-full rounded-xl border border-admin-border bg-admin-surface py-2.5 pl-10 pr-3 text-sm text-admin-foreground outline-none placeholder:text-admin-foreground/40 focus:border-gold-500 focus-visible:ring-2 focus-visible:ring-gold-500/35"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-admin-border px-6 py-14 text-center text-sm text-admin-foreground/55">
          {registrations.length === 0
            ? "Ainda não há novos cadastros."
            : "Nenhum cadastro corresponde à busca."}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((registration) => {
            const student = studentById.get(registration.studentId);
            const answers = registration.answers;
            const assignedGroup = student?.enrollment
              ? groups.find((group) => group.id === student.enrollment?.groupId)
              : null;
            const paymentLabel =
              registration.subscriptionStatus === "trialing"
                ? `Experiência até ${date(registration.trialEnd)}`
                : registration.subscriptionStatus === "active"
                  ? "Assinatura ativa"
                  : registration.subscriptionStatus
                    ? paymentStatusLabel(registration.subscriptionStatus)
                    : "Aguardando cadastro do pagamento";

            return (
              <article
                key={registration.studentId}
                className="rounded-2xl border border-admin-border bg-admin-surface p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-admin-foreground">
                      {registration.fullName}
                    </h3>
                    <p className="mt-1 break-all text-sm text-admin-foreground/60">
                      {registration.email}
                    </p>
                    {registration.phone && (
                      <p className="mt-0.5 text-sm text-admin-foreground/60">
                        {registration.phone}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-admin-foreground/45">
                      Enviado em {date(registration.submittedAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${student?.enrollment ? "bg-success/10 text-success" : "bg-gold-100 text-gold-800"}`}
                  >
                    {student?.enrollment ? "Turma designada" : "Aguardando turma"}
                  </span>
                </div>

                <dl className="mt-4 grid gap-x-5 gap-y-3 border-t border-admin-border pt-4 sm:grid-cols-2">
                  <Detail
                    label="Plano escolhido"
                    value={registration.requestedPlanName ?? "Plano indisponível"}
                  />
                  <Detail label="Pagamento" value={paymentLabel} />
                  <Detail
                    label="Maior de 18 anos"
                    value={answers.isAdult ? "Sim" : "Não"}
                  />
                  <Detail
                    label="Contato por e-mail e WhatsApp"
                    value={answers.contactConsent ? "Autorizado" : "Não autorizado"}
                  />
                  <Detail
                    label="Situação"
                    value={
                      SITUATION_LABELS[answers.studySituation] ?? answers.studySituation
                    }
                  />
                  {(answers.studySituation === "work" ||
                    answers.studySituation === "both") && (
                    <Detail
                      label="Profissão"
                      value={
                        answers.profession === "other"
                          ? answers.professionOther || "Outro"
                          : (PROFESSION_LABELS[answers.profession] ?? answers.profession)
                      }
                    />
                  )}
                  {!answers.isAdult && (
                    <Detail
                      label="Responsável"
                      value={
                        [
                          answers.guardianName,
                          answers.guardianPhone,
                          answers.guardianEmail,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Não informado"
                      }
                    />
                  )}
                  <Detail
                    label="Tópicos de interesse"
                    value={labels(answers.focusTopics, FOCUS_LABELS)}
                  />
                  <Detail
                    label="Estilo de ensino"
                    value={labels(answers.learningStyles, STYLE_LABELS)}
                  />
                  <div className="sm:col-span-2">
                    <Detail
                      label="Objetivo das aulas"
                      value={answers.goal || "Não informado"}
                    />
                  </div>
                  {assignedGroup && (
                    <Detail
                      label="Turma / professor"
                      value={`${assignedGroup.name} · ${assignedGroup.teacherName}`}
                    />
                  )}
                </dl>

                {!student?.enrollment && student && (
                  <button
                    type="button"
                    onClick={() => onAssign(student)}
                    className="mt-4 rounded-xl bg-admin-foreground px-4 py-2.5 text-sm font-semibold text-admin-background transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  >
                    Designar turma e professor
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-admin-foreground/45">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-admin-foreground">{value}</dd>
    </div>
  );
}

function labels(values: string[], dictionary: Record<string, string>) {
  return values.length
    ? values.map((value) => dictionary[value] ?? value).join(", ")
    : "Não informado";
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function paymentStatusLabel(status: StudentRegistration["subscriptionStatus"]): string {
  if (!status) return "Aguardando cadastro do pagamento";
  return {
    incomplete: "Checkout não concluído",
    incomplete_expired: "Checkout expirado",
    trialing: "Em experiência",
    active: "Assinatura ativa",
    past_due: "Pagamento atrasado",
    canceled: "Assinatura cancelada",
    unpaid: "Pagamento pendente",
    paused: "Assinatura pausada",
  }[status];
}
