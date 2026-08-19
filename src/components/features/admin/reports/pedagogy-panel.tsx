"use client";

/**
 * Aba pedagógica do relatório — o conteúdo que a tela já tinha (frequência,
 * risco, aulas por professor, distribuição de nível), agora no vocabulário
 * visual do painel: cartões, medidor radial e barras no lugar de tabelas
 * cruas.
 *
 * Fica ao lado das abas financeiras de propósito: a mesma pergunta de gestão
 * ("a turma X vale o que custa?") depende dos dois lados, e trocar de aba é
 * mais barato do que trocar de página.
 */

import { motion, useReducedMotion } from "framer-motion";
import {
  Card,
  CardHeader,
  EmptyState,
  RevealGrid,
  RevealItem,
  formatNumber,
} from "@/components/features/admin/dashboard/primitives";
import { BarList, DonutChart, PALETTE, RadialGauge } from "@/components/features/admin/dashboard/charts";
import { cn } from "@/lib/utils";
import type { AdminReport } from "@/repositories/reports";

const LEVEL_COLORS = [
  PALETTE.navy,
  PALETTE.navyMid,
  PALETTE.navySoft,
  PALETTE.goldPale,
  PALETTE.goldSoft,
  PALETTE.gold,
];

/** Verde acima de 90%, âmbar de 75 a 90, vermelho abaixo — o mesmo corte do alerta. */
function attendanceTone(rate: number | null): string {
  if (rate == null) return PALETTE.muted;
  if (rate >= 90) return "#0f9d76";
  if (rate >= 75) return PALETTE.gold;
  return "#e11d48";
}

export function PedagogyPanel({ report }: { report: AdminReport }) {
  const reduced = useReducedMotion();

  const rated = report.groups.filter((group) => group.attendanceRate != null);
  const averageAttendance =
    rated.length > 0
      ? Math.round(
          (10 * rated.reduce((sum, group) => sum + (group.attendanceRate ?? 0), 0)) /
            rated.length,
        ) / 10
      : null;

  const levelSlices = report.levelDistribution.map((row, index) => ({
    label: row.level,
    value: row.count,
    color: LEVEL_COLORS[index % LEVEL_COLORS.length]!,
  }));
  const totalStudents = report.levelDistribution.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-5">
      <RevealGrid className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <RevealItem className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader
              title="Frequência e conclusão de tarefas"
              subtitle="Por turma ativa, sobre as aulas já concluídas"
              action={
                <span className="text-[11px] text-admin-foreground/45">
                  {report.groups.length} {report.groups.length === 1 ? "turma" : "turmas"}
                </span>
              }
            />
            {report.groups.length === 0 ? (
              <div className="p-5">
                <EmptyState>Nenhuma turma ativa.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-admin-border/70 px-5">
                {report.groups.map((group, index) => (
                  <motion.li
                    key={group.groupId}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.04 }}
                    className="py-3.5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-admin-foreground">
                          {group.groupName}
                        </span>
                        <span className="text-[11px] text-admin-foreground/50">
                          {group.teacherName}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-4">
                        <Metric
                          label="frequência"
                          value={group.attendanceRate}
                          color={attendanceTone(group.attendanceRate)}
                        />
                        <Metric
                          label="tarefas"
                          value={group.assignmentCompletionRate}
                          color={PALETTE.navyMid}
                        />
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <Track
                        value={group.attendanceRate}
                        color={attendanceTone(group.attendanceRate)}
                        delay={index * 0.04}
                      />
                      <Track
                        value={group.assignmentCompletionRate}
                        color={PALETTE.navyMid}
                        delay={0.08 + index * 0.04}
                      />
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className="flex h-full flex-col">
            <CardHeader title="Frequência média" subtitle="Todas as turmas ativas" />
            <div className="flex flex-1 items-center justify-center p-5">
              {averageAttendance == null ? (
                <EmptyState>Ainda não há aulas concluídas.</EmptyState>
              ) : (
                <RadialGauge
                  value={averageAttendance}
                  label={`${formatNumber(averageAttendance, 1)}%`}
                  caption={`${report.studentsAtRisk.length} aluno(s) abaixo de 75%`}
                  color={attendanceTone(averageAttendance)}
                />
              )}
            </div>
          </Card>
        </RevealItem>
      </RevealGrid>

      <RevealGrid className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <RevealItem>
          <Card className="h-full">
            <CardHeader
              title="Alunos em risco"
              subtitle="Frequência abaixo de 75%"
              action={
                report.studentsAtRisk.length > 0 ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    {report.studentsAtRisk.length}
                  </span>
                ) : undefined
              }
            />
            <div className="p-5">
              {report.studentsAtRisk.length === 0 ? (
                <EmptyState>Nenhum aluno em risco no momento.</EmptyState>
              ) : (
                <ul className="space-y-2.5">
                  {report.studentsAtRisk.map((student) => (
                    <li
                      key={`${student.studentId}-${student.groupName}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-admin-foreground">
                          {student.studentName}
                        </span>
                        <span className="text-[11px] text-admin-foreground/50">
                          {student.groupName}
                        </span>
                      </span>
                      <span className="tabular shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                        {formatNumber(student.attendanceRate, 1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Aulas ministradas" subtitle="Por professor, aulas concluídas" />
            <div className="p-5">
              {report.teacherSessions.length === 0 ? (
                <EmptyState>Nenhuma aula concluída ainda.</EmptyState>
              ) : (
                <BarList
                  rows={report.teacherSessions.map((teacher) => ({
                    label: teacher.teacherName,
                    value: teacher.sessionsCompleted,
                    display: `${formatNumber(teacher.sessionsCompleted)} · ${formatNumber(Math.round(teacher.totalMinutes / 60))}h`,
                  }))}
                />
              )}
            </div>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Distribuição de nível" subtitle="Alunos por nível CEFR" />
            <div className="flex items-center justify-center p-5">
              {levelSlices.length === 0 ? (
                <EmptyState>Nenhum aluno cadastrado.</EmptyState>
              ) : (
                <DonutChart
                  slices={levelSlices}
                  centerValue={formatNumber(totalStudents)}
                  centerLabel="alunos"
                />
              )}
            </div>
          </Card>
        </RevealItem>
      </RevealGrid>
    </div>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <span className="text-right">
      <span
        className={cn("tabular block text-sm font-semibold")}
        style={{ color: value == null ? PALETTE.muted : color }}
      >
        {value == null ? "—" : `${formatNumber(value, 1)}%`}
      </span>
      <span className="text-[10px] uppercase tracking-[0.1em] text-admin-foreground/40">
        {label}
      </span>
    </span>
  );
}

function Track({
  value,
  color,
  delay,
}: {
  value: number | null;
  color: string;
  delay: number;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-admin-muted">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={reduced ? false : { width: 0 }}
        whileInView={{ width: `${Math.min(100, value ?? 0)}%` }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
