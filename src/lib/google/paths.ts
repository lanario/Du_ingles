import { ADMIN_BASE, TEACHER_BASE } from "@/lib/areas";
import type { AppRole } from "@/types/domain";

/** A agenda de cada papel mora num prefixo diferente. */
export function agendaPath(role: AppRole): string {
  if (role === "student") return "/agenda";
  return `${role === "admin" ? ADMIN_BASE : TEACHER_BASE}/agenda`;
}
