import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listGroups } from "@/repositories/groups";
import { listCourses } from "@/repositories/courses";
import { listUsers } from "@/repositories/users";
import { TurmasView } from "@/components/features/admin/groups/turmas-view";

export const metadata: Metadata = { title: "Turmas" };

interface PageProps {
  searchParams: Promise<{ nova?: string }>;
}

export default async function TurmasPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin"]);
  const { nova } = await searchParams;

  const [groups, courses, teachers] = await Promise.all([
    listGroups(),
    listCourses(),
    listUsers(ctx.organizationId, { role: "teacher" }),
  ]);

  return (
    <TurmasView
      groups={groups}
      courses={courses}
      teachers={teachers}
      openCreate={nova !== undefined}
    />
  );
}
