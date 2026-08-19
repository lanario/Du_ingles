"use client";

import { useActionState, useEffect, useState } from "react";
import { requestGroupChangeAction } from "@/actions/student/group-change";
import {
  GroupCard,
  LevelBadge,
  formatSchedule,
} from "@/components/features/groups/group-card";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { CalendarIcon, SwapIcon } from "@/components/ui/icons";
import type { GroupDetail } from "@/repositories/groups";
import type { StudentEnrollmentItem } from "@/repositories/enrollments";

export interface StudentGroupView {
  group: GroupDetail;
  enrollment: StudentEnrollmentItem;
}

function ChangeGroupDialog({
  open,
  onClose,
  myGroups,
  otherGroups,
}: {
  open: boolean;
  onClose: () => void;
  myGroups: StudentGroupView[];
  otherGroups: GroupDetail[];
}) {
  const [state, formAction, isPending] = useActionState(requestGroupChangeAction, null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (state?.success) setSent(true);
  }, [state]);

  const fields = state && !state.success ? state.error.fields : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Pedir troca de turma"
      description="O pedido vai para o professor da turma escolhida, que confirma a mudança."
    >
      {sent ? (
        <div className="space-y-4">
          <FormBanner tone="success">
            Pedido enviado. Você será avisado quando o professor responder.
          </FormBanner>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          {state && !state.success && !state.error.fields && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="change-from">Turma atual</Label>
            <Select
              id="change-from"
              name="enrollmentId"
              defaultValue={myGroups[0]?.enrollment.id ?? ""}
            >
              {myGroups.map((item) => (
                <option key={item.enrollment.id} value={item.enrollment.id}>
                  {item.group.name} · {item.group.level}
                </option>
              ))}
            </Select>
            <FieldError messages={fields?.["enrollmentId"]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="change-to">Turma desejada</Label>
            <Select id="change-to" name="toGroupId" defaultValue="">
              <option value="">Selecione…</option>
              {otherGroups.map((group) => (
                <option
                  key={group.id}
                  value={group.id}
                  disabled={group.enrolledCount >= group.maxStudents}
                >
                  {group.name} · {group.level}
                  {group.enrolledCount >= group.maxStudents ? " (lotada)" : ""}
                </option>
              ))}
            </Select>
            <FieldError messages={fields?.["toGroupId"]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="change-reason">Motivo (opcional)</Label>
            <textarea
              id="change-reason"
              name="reason"
              rows={3}
              maxLength={500}
              placeholder="Ex.: mudei de horário no trabalho."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <FieldError messages={fields?.["reason"]} />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || otherGroups.length === 0}>
              {isPending ? "Enviando…" : "Enviar pedido"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function StudentGroups({
  myGroups,
  otherGroups,
}: {
  myGroups: StudentGroupView[];
  otherGroups: GroupDetail[];
}) {
  const [open, setOpen] = useState(false);
  const canRequest = myGroups.length > 0 && otherGroups.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Turmas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suas turmas, horários e o caminho para pedir uma troca.
          </p>
        </div>
        {canRequest && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            className="gap-2 rounded-xl"
          >
            <SwapIcon className="h-4 w-4" />
            Pedir troca de turma
          </Button>
        )}
      </div>

      {myGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
          <p className="font-medium text-navy-900">Você ainda não está em uma turma.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Fale com a coordenação pelas Mensagens para ser matriculado.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {myGroups.map((item, index) => (
            <GroupCard
              key={item.group.id}
              group={item.group}
              index={index}
              badge={
                item.enrollment.status !== "active" ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {item.enrollment.status}
                  </span>
                ) : null
              }
            />
          ))}
        </div>
      )}

      {otherGroups.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Outras turmas da escola
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
            {otherGroups.map((group) => {
              const slots = formatSchedule(group.schedule);
              const full = group.enrolledCount >= group.maxStudents;
              return (
                <li
                  key={group.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-navy-900">
                        {group.name}
                      </span>
                      <LevelBadge level={group.level} />
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {slots.length > 0 ? slots.join(" · ") : "sem horário definido"}
                    </p>
                  </div>
                  <span className="tabular text-xs text-muted-foreground">
                    {full ? "lotada" : `${group.enrolledCount}/${group.maxStudents}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ChangeGroupDialog
        open={open}
        onClose={() => setOpen(false)}
        myGroups={myGroups}
        otherGroups={otherGroups}
      />
    </div>
  );
}
