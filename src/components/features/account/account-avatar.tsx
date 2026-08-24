/**
 * Retrato da pessoa. Com foto enviada mostra a imagem; sem foto, cai nas
 * iniciais no tom estável do usuário — o mesmo par `toneOf`/`initialsOf` que
 * os cartões de usuário já usam, para que a mesma pessoa tenha sempre a mesma
 * cor em qualquer tela.
 *
 * `<img>` puro e não `next/image`: a URL é a rota autenticada
 * `/api/avatars/...`, que responde 307 para uma signed URL de 5 minutos — o
 * otimizador não tem o que cachear aí, e seguiria o redirect a cada request.
 */

import { cn } from "@/lib/utils";
import { initialsOf, toneOf } from "@/components/features/admin/users/users-utils";

const SIZES = {
  xs: "h-8 w-8 text-[11px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
} as const;

export type AccountAvatarSize = keyof typeof SIZES;

interface AccountAvatarProps {
  /** Chave estável do tom (id do usuário). */
  id: string;
  /** Nome ou e-mail de onde saem as iniciais. */
  name: string;
  /** URL relativa da foto (`/api/avatars/...`) ou `null`. */
  src?: string | null;
  size?: AccountAvatarSize;
  className?: string;
}

export function AccountAvatar({
  id,
  name,
  src,
  size = "md",
  className,
}: AccountAvatarProps) {
  const base = cn("shrink-0 overflow-hidden rounded-full", SIZES[size], className);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`Foto de ${name}`}
        className={cn(base, "object-cover ring-1 ring-black/10")}
      />
    );
  }

  const tone = toneOf(id);
  return (
    <span
      aria-hidden
      style={{
        color: tone,
        backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 26%, transparent)`,
      }}
      className={cn(base, "grid place-items-center font-semibold tracking-wide")}
    >
      {initialsOf(name)}
    </span>
  );
}
