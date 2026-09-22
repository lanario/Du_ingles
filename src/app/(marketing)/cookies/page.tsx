import type { Metadata } from "next";
import Link from "next/link";
import { CookiePreferencesLink } from "@/components/features/consent/cookie-consent";
import { CONSENT_VERSION, COOKIE_INVENTORY, categoriesInUse } from "@/lib/consent/config";

export const metadata: Metadata = { title: "Política de cookies" };

/**
 * Gerada a partir de `lib/consent/config.ts` — o mesmo inventário que o banner
 * usa. Se a lista aqui estiver errada, o banner também está.
 */
export default function CookiesPage() {
  const [year, month, day] = CONSENT_VERSION.split("-");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Política de cookies</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Versão de {day}/{month}/{year}
      </p>

      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Cookies e armazenamento local são pequenos dados que o site guarda no seu
          navegador. O Du Inglês usa o mínimo possível: não há publicidade, pixel de rede
          social nem ferramenta de rastreamento de terceiros.
        </p>
        <p>
          Os itens estritamente necessários funcionam sem pedir permissão, porque sem eles
          não é possível entrar na conta nem proteger o login (LGPD, art. 7º, V e IX).
          Todo o resto só é usado depois que você aceita, e pode ser recusado sem perder
          nenhuma função do site.
        </p>
        <p>
          <CookiePreferencesLink className="font-medium text-foreground underline">
            Alterar minhas preferências de cookies
          </CookiePreferencesLink>
        </p>

        {categoriesInUse().map((category) => {
          const items = COOKIE_INVENTORY.filter((item) => item.category === category.id);
          return (
            <section key={category.id} className="pt-4">
              <h2 className="text-base font-semibold text-foreground">
                {category.label}
                {category.required ? " (sempre ativos)" : " (dependem de aceite)"}
              </h2>
              <p className="mt-1">{category.description}</p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead className="bg-muted/60 text-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Nome</th>
                      <th className="px-3 py-2 font-medium">Tipo</th>
                      <th className="px-3 py-2 font-medium">Finalidade</th>
                      <th className="px-3 py-2 font-medium">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.name} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-mono text-xs text-foreground">
                          {item.name}
                        </td>
                        <td className="px-3 py-2">
                          {item.kind === "cookie" ? "Cookie" : "Armazenamento local"}
                        </td>
                        <td className="px-3 py-2">{item.purpose}</td>
                        <td className="px-3 py-2">{item.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        <h2 className="pt-4 text-base font-semibold text-foreground">
          Como retirar o consentimento
        </h2>
        <p>
          A qualquer momento, pelo link acima, pelo rodapé do site ou em &quot;Meus
          dados&quot; dentro da plataforma. Ao recusar, apagamos na hora o que tinha sido
          guardado no navegador. Registramos a escolha (data, versão desta política,
          endereço IP e navegador), sem nenhum histórico de navegação, para podermos
          demonstrar que ela foi respeitada. A pergunta volta a cada seis meses ou quando
          esta política mudar.
        </p>
        <p>
          Você também pode apagar cookies nas configurações do seu navegador; os
          necessários voltam a ser criados quando você entrar na conta.
        </p>
        <p>
          Mais detalhes sobre como tratamos seus dados estão na{" "}
          <Link href="/privacidade" className="underline">
            política de privacidade
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
