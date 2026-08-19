import { redirect } from "next/navigation";

/**
 * A criação direta (e-mail + senha provisória digitada pelo admin) saiu:
 * todo cadastro agora nasce de um convite por WhatsApp, preenchido pela
 * própria pessoa. A rota fica de pé só para não quebrar link antigo ou
 * favorito — manda para a lista já com o painel de convite aberto.
 */
export default function NovoUsuarioPage() {
  redirect("/admin/usuarios?convite=1");
}

