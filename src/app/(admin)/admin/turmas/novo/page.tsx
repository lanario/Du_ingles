import { redirect } from "next/navigation";

/**
 * A criação de turma saiu da própria página e virou painel lateral, no
 * mesmo padrão do convite de usuário (`TurmasView` → `CreateGroupPanel`).
 * Rota mantida só para não quebrar link ou favorito antigo.
 */
export default function NovaTurmaPage() {
  redirect("/admin/turmas?nova=1");
}
