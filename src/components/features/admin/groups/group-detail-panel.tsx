"use client";

/**
 * Detalhe da turma no painel lateral — o que abre ao clicar num cartão.
 * Mostra tudo o que a lista já carregou (nenhuma ida ao servidor: a página
 * entrega a projeção completa), e manda para `/admin/turmas/[id]` quando o
 * assunto é matrícula ou sessão, que exigem dados que a lista não tem.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SidePanel } from "@/components/ui/side-panel";
import {
  DetailActions,
  DetailBody,
  DetailButton,
  DetailRow,
  DetailSection,
} from "@/components/ui/detail-panel";
import {
  CalendarIcon,
  GraduationIcon,
  GroupsIcon,
  PencilIcon,
  PowerIcon,
  UserIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  GroupStatusPill,
  LevelPill,
  OccupancyRing,
  TeacherPill,
} from "./groups-visuals";
import {
  WEEKDAY_LONG,
  formatMinutes,
  occupancyLabel,
  occupancyTone,
  periodLabel,
  seatsLeft,
  sortedSchedule,
  weeklyMinutes,
  type Group,
} from "./groups-utils";

interface GroupDetailPanelProps {
  open: boolean;
  onClose: () => void;
  group: Group | null;
  onEdit: () => void;
  onToggleActive: () => void;
  busy: boolean;
}

export function GroupDetailPanel({
  open,
  onClose,
  group,
  onEdit,
  onToggleActive,
  busy,
}: GroupDetailPanelProps) {
  const reduceMotion = useReducedMotion();

  return (
    <SidePanel
      open={open && group !== null}
      onClose={onClose}
      title={group?.name ?? "Turma"}
      subtitle={group ? `${group.level} · ${group.teacherName}` : undefined}
    >
      {group && (
        <DetailBody>
          <div className="flex items-center gap-4">
            <OccupancyRing group={group} size={88} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: occupancyTone(group) }}>
                {occupancyLabel(group)}
              </p>
              <p className="mt-0.5 text-xs text-admin-foreground/55">
                {group.enrolledCount} de {group.maxStudents} lugares ocupados
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <GroupStatusPill isActive={group.isActive} />
                <LevelPill level={group.level} />
              </div>
            </div>
          </div>

          <DetailActions>
            <DetailButton
              icon={GroupsIcon}
              label="Abrir turma"
              href={`/admin/turmas/${group.id}`}
              tone="accent"
            />
            <DetailButton icon={PencilIcon} label="Editar" onClick={onEdit} disabled={busy} />
            <DetailButton
              icon={PowerIcon}
              label={group.isActive ? "Arquivar" : "Reativar"}
              onClick={onToggleActive}
              disabled={busy}
              tone={group.isActive ? "danger" : "accent"}
            />
          </DetailActions>

          <DetailSection title="Grade semanal">
            {group.schedule.length === 0 ? (
              <p className="rounded-xl border border-dashed border-admin-border px-4 py-6 text-center text-sm text-admin-foreground/50">
                Nenhum horário definido — sem grade, o sistema não gera as sessões da turma.
              </p>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-admin-border">
                <AnimatePresence initial={false}>
                  {sortedSchedule(group.schedule).map((entry, index) => (
                    <motion.li
                      key={`${entry.weekday}-${entry.start}-${index}`}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.28, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        "flex items-center justify-between gap-3 border-b border-admin-border px-3.5 py-2.5 text-sm last:border-0",
                        "bg-admin-surface",
                      )}
                    >
                      <span className="flex items-center gap-2.5 text-admin-foreground">
                        <span
                          aria-hidden
                          className="grid h-7 w-7 place-items-center rounded-lg bg-gold-50 text-[10px] font-semibold uppercase text-gold-700"
                        >
                          {WEEKDAY_LONG[entry.weekday]?.slice(0, 3)}
                        </span>
                        {WEEKDAY_LONG[entry.weekday]}
                      </span>
                      <span className="tabular text-admin-foreground/70">
                        {entry.start} – {entry.end}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
            <p className="mt-2 text-xs text-admin-foreground/50">
              Carga semanal: {formatMinutes(weeklyMinutes(group.schedule))}
            </p>
          </DetailSection>

          <DetailSection title="Dados da turma">
            <DetailRow icon={UserIcon} label="Professor responsável" value={group.teacherName} />
            <DetailRow icon={GraduationIcon} label="Curso" value={group.courseName} />
            <DetailRow icon={GroupsIcon} label="Nível (CEFR)" value={group.level} />
            <DetailRow
              icon={UserIcon}
              label="Vagas restantes"
              value={String(seatsLeft(group))}
            />
            <DetailRow icon={CalendarIcon} label="Período" value={periodLabel(group)} />
          </DetailSection>

          <DetailSection title="Responsável">
            <TeacherPill id={group.teacherId} name={group.teacherName} />
          </DetailSection>
        </DetailBody>
      )}
    </SidePanel>
  );
}
