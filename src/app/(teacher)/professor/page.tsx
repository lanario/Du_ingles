import { redirect } from "next/navigation";

/** A área do professor começa pelas turmas — é o dia a dia dele. */
export default function ProfessorHomePage() {
  redirect("/professor/turmas");
}
