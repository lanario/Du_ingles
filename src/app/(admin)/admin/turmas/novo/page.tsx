import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listCourses } from "@/repositories/courses";
import { listUsers } from "@/repositories/users";
import { CreateGroupForm } from "@/components/features/admin/groups/create-group-form";

export const metadata: Metadata = { title: "Nova turma" };

export default async function NovaTurmaPage() {
  const ctx = await requireRole(["admin"]);
  const [courses, teachers] = await Promise.all([
    listCourses(),
    listUsers(ctx.organizationId, { role: "teacher" }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Nova turma</h1>
      <div className="mt-8">
        <CreateGroupForm courses={courses} teachers={teachers} />
      </div>
    </div>
  );
}
