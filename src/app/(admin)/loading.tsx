import { PageLoader } from "@/components/ui/logo-loader";

/**
 * Carregamento de qualquer rota do painel administrativo. Fica no nível do
 * grupo, não em cada pasta: o `<main>` do layout é o mesmo para as vinte e
 * poucas telas do admin, e uma cópia por rota só daria vinte arquivos para
 * manter em sincronia.
 */
export default function AdminLoading() {
  return <PageLoader />;
}
