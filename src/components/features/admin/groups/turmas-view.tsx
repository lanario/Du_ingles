"use client";

/**
 * Área de turmas: mesma decisão do `UsersView` — a criação vira um painel
 * lateral em vez de navegar para outra página, então o admin nunca perde a
 * lista de vista. A tabela em si continua a mesma da página anterior; só o
 * gatilho de criação muda de `<Link>` para o painel.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CreateGroupPanel } from "./create-group-panel";
import { PlusIcon } from "@/components/ui/icons";
import type { GroupListItem } from "@/repositories/groups";
import type { Course } from "@/repositories/courses";
import type { UserListItem } from "@/repositories/users";

export function TurmasView({
  groups,
  courses,
  teachers,
  openCreate = false,
}: {
  groups: GroupListItem[];
  courses: Course[];
  teachers: UserListItem[];
  openCreate?: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [panelOpen, setPanelOpen] = useState(openCreate);

  // `?nova=1` (vindo de /admin/turmas/novo, mantida por compatibilidade)
  // só deve abrir o painel uma vez — sem isto, um F5 reabriria sozinho.
  function closePanel() {
    setPanelOpen(false);
    if (openCreate) router.replace("/admin/turmas");
  }

  useEffect(() => {
    setPanelOpen(openCreate);
  }, [openCreate]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-admin-foreground">Turmas</h1>
          <p className="mt-2 text-sm text-admin-foreground/60">
            Turmas ativas, professores responsáveis e ocupação.
          </p>
        </div>
        <motion.button
          type="button"
          onClick={() => setPanelOpen(true)}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-3 py-2.5 text-sm font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 sm:px-4"
        >
          <PlusIcon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Nova turma</span>
        </motion.button>
      </div>

      {groups.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-admin-border px-6 py-16 text-center">
          <p className="text-admin-foreground/70">Nenhuma turma criada ainda.</p>
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-semibold text-admin-foreground transition-opacity hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Nova turma
          </button>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-admin-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border text-left text-admin-foreground/60">
                <th className="px-4 py-3 font-medium">Turma</th>
                <th className="px-4 py-3 font-medium">Professor</th>
                <th className="px-4 py-3 font-medium">Curso</th>
                <th className="px-4 py-3 font-medium">Nível</th>
                <th className="px-4 py-3 font-medium">Alunos</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-b border-admin-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/turmas/${group.id}`} className="hover:underline">
                      {group.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-admin-foreground/70">{group.teacherName}</td>
                  <td className="px-4 py-3 text-admin-foreground/70">
                    {group.courseName ?? "—"}
                  </td>
                  <td className="px-4 py-3">{group.level}</td>
                  <td className="px-4 py-3 text-admin-foreground/70">
                    {group.enrolledCount}/{group.maxStudents}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateGroupPanel
        open={panelOpen}
        onClose={closePanel}
        courses={courses}
        teachers={teachers}
      />
    </div>
  );
}
