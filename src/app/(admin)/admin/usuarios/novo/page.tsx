import { redirect } from "next/navigation";

/**
 * O cadastro iniciado pela coordenação continua usando convites, preenchidos
 * pela própria pessoa. Alunos novos também podem iniciar o autocadastro em
 * /cadastro. Esta rota antiga fica para links salvos e abre o painel de convite.
 */
export default function NovoUsuarioPage() {
  redirect("/admin/usuarios?convite=1");
}
