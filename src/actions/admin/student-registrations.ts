"use server";

import { requireRole } from "@/lib/auth/session";
import { listStudentRegistrations } from "@/repositories/student-registrations";

export async function listStudentRegistrationsAction() {
  const ctx = await requireRole(["admin"]);
  return listStudentRegistrations(ctx.organizationId);
}
