"use client";

/**
 * Em que área do painel esta tela está sendo renderizada.
 *
 * As telas de Turmas, Alunos, Planejador e Mensagens são as mesmas para a
 * coordenação (`/admin`) e para o professor (`/professor`) — o que muda é o
 * prefixo dos links e o teto de permissão. Passar isso por props significaria
 * atravessar quinze componentes (cartão → menu → painel → formulário); um
 * contexto resolve num nível só.
 *
 * O padrão é a área do admin: as páginas de `/admin` não precisam montar
 * provider nenhum e continuam funcionando exatamente como antes.
 */

import { createContext, useContext, type ReactNode } from "react";
import { ADMIN_BASE, TEACHER_BASE } from "@/lib/areas";

export interface AreaConfig {
  /** Prefixo das rotas desta área — `/admin` ou `/professor`. */
  base: string;
  role: "admin" | "teacher";
  /** Cadastrar, desativar ou editar pessoas — só a coordenação. */
  canManagePeople: boolean;
  /** Criar turma, arquivar e trocar o professor responsável. */
  canManageGroups: boolean;
}

export const ADMIN_AREA: AreaConfig = {
  base: ADMIN_BASE,
  role: "admin",
  canManagePeople: true,
  canManageGroups: true,
};

/**
 * O professor opera a própria turma (matrícula, grade, aula, tarefa) mas não
 * coordena a escola: não cria turma, não reatribui responsável e não mexe no
 * cadastro de ninguém.
 */
export const TEACHER_AREA: AreaConfig = {
  base: TEACHER_BASE,
  role: "teacher",
  canManagePeople: false,
  canManageGroups: false,
};

const AreaContext = createContext<AreaConfig>(ADMIN_AREA);

export function AreaProvider({
  value,
  children,
}: {
  value: AreaConfig;
  children: ReactNode;
}) {
  return <AreaContext.Provider value={value}>{children}</AreaContext.Provider>;
}

export function useArea(): AreaConfig {
  return useContext(AreaContext);
}
