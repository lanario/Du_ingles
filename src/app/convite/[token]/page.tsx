import type { Metadata } from "next";
import Link from "next/link";
import { getInviteByToken } from "@/services/invites";
import { AcceptInviteForm } from "@/components/features/auth/accept-invite-form";
import { formatPhoneDisplay } from "@/lib/phone";
import type { AppRole } from "@/types/domain";

export const metadata: Metadata = {
  title: "Criar acesso",
  // Link pessoal: nem indexado nem seguido, mesmo se cair num buscador.
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  teacher: "Professor",
  student: "Aluno",
};

/**
 * Destino do link enviado no WhatsApp. Página pública por definição — o
 * middleware não protege `/convite` porque quem chega aqui ainda não tem
 * conta. Quem autoriza é o token: ele carrega a organização e o papel, e
 * o formulário nunca recebe nenhum dos dois do cliente.
 */
export default async function ConvitePage({ params }: PageProps) {
  const { token } = await params;
  const lookup = await getInviteByToken(token);

  if (lookup.status !== "valid") {
    return <InviteUnavailable status={lookup.status} />;
  }

  const { invite } = lookup;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="inline-flex items-center rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold-700">
          Convite · {ROLE_LABEL[invite.role]}
        </span>
        <h1 className="text-xl font-semibold text-navy-900">Crie o seu acesso</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os dados abaixo para entrar na plataforma. Todos os campos são
          obrigatórios.
        </p>
      </header>

      <AcceptInviteForm
        token={token}
        defaultFullName={invite.fullName}
        phoneDisplay={formatPhoneDisplay(invite.phone)}
      />
    </div>
  );
}

function InviteUnavailable({
  status,
}: {
  status: "expired" | "accepted" | "revoked" | "not_found";
}) {
  const copy = {
    expired: {
      title: "Convite expirado",
      description:
        "Este link passou da validade. Peça um novo convite à escola pelo WhatsApp.",
    },
    accepted: {
      title: "Convite já utilizado",
      description:
        "Este cadastro já foi concluído. Entre com o e-mail e a senha que você cadastrou.",
    },
    revoked: {
      title: "Convite cancelado",
      description:
        "Este link foi substituído ou cancelado. Verifique se recebeu um convite mais recente.",
    },
    not_found: {
      title: "Convite não encontrado",
      description:
        "O link parece incompleto. Confira se ele foi copiado inteiro da mensagem.",
    },
  }[status];

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-semibold text-navy-900">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.description}</p>
      <Link
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Ir para o login
      </Link>
    </div>
  );
}
