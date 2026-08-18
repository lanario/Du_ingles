import type { Metadata } from "next";
import { CreateLessonPlanForm } from "@/components/features/lesson-plans/create-lesson-plan-form";

export const metadata: Metadata = { title: "Novo plano de aula" };

export default function NovoPlanoDeAulaPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Novo plano de aula</h1>
      <div className="mt-8">
        <CreateLessonPlanForm />
      </div>
    </div>
  );
}
