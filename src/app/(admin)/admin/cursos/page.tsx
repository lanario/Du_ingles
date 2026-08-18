import type { Metadata } from "next";
import { listCourses } from "@/repositories/courses";
import { CreateCourseForm } from "@/components/features/admin/groups/create-course-form";

export const metadata: Metadata = { title: "Cursos" };

export default async function CursosPage() {
  const courses = await listCourses();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Cursos</h1>

      <div className="mt-6 rounded-lg border border-admin-border p-4">
        <CreateCourseForm />
      </div>

      {courses.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-admin-border p-10 text-center text-admin-foreground/70">
          Nenhum curso cadastrado ainda.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-admin-border rounded-lg border border-admin-border">
          {courses.map((course) => (
            <li key={course.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{course.name}</p>
                {course.description && (
                  <p className="text-xs text-admin-foreground/60">{course.description}</p>
                )}
              </div>
              <span className="rounded-full bg-admin-muted px-2.5 py-0.5 text-xs">
                {course.level}
                {course.totalHours ? ` · ${course.totalHours}h` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
