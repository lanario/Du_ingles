"use client";

/**
 * Foto de perfil: escolher, enviar e remover. O envio vai direto para
 * `POST /api/avatars/upload` (binário como binário, ver o comentário da rota)
 * e o resultado entra na tela por `router.refresh()` — o nome e a foto também
 * vivem no menu da sidebar, que é do layout.
 *
 * A checagem de tamanho aqui é só cortesia: quem manda é o limite do bucket
 * (`AVATAR_MAX_BYTES`, espelhado em `0029_avatars_bucket.sql`). Vale a pena
 * mesmo assim — recusar antes de subir 8 MB é a diferença entre um aviso
 * instantâneo e meio minuto de espera num 4G ruim.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMyAvatarAction } from "@/actions/shared/account";
import { AccountAvatar } from "@/components/features/account/account-avatar";
import {
  accountClasses,
  type AccountTheme,
} from "@/components/features/account/account-theme";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";

/** Espelha `AVATAR_MAX_BYTES`/`AVATAR_MIME_TYPES` de `lib/avatars.ts`. */
const MAX_MB = 2;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp";

interface AvatarUploaderProps {
  userId: string;
  name: string;
  avatarUrl: string | null;
  theme?: AccountTheme;
}

export function AvatarUploader({
  userId,
  name,
  avatarUrl,
  theme = "app",
}: AvatarUploaderProps) {
  const classes = accountClasses(theme);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, startRemove] = useTransition();

  const shown = preview ?? avatarUrl;
  const busy = uploading || removing;

  async function onPick(file: File) {
    setError(null);

    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Formato não suportado. Use PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Imagem muito grande (máximo ${MAX_MB} MB).`);
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/avatars/upload", { method: "POST", body });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        setPreview(null);
        setError(payload.error ?? "Não foi possível enviar a foto.");
        return;
      }
      router.refresh();
    } catch {
      setPreview(null);
      setError("Falha de conexão ao enviar a foto.");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onRemove() {
    setError(null);
    startRemove(async () => {
      const result = await removeMyAvatarAction();
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <div className={classes.card}>
      <h2 className={classes.heading}>Foto de perfil</h2>
      <p className={cn("mt-1", classes.muted)}>
        PNG, JPG ou WEBP de até {MAX_MB} MB. A imagem aparece no seu menu, nas turmas e
        nas conversas.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-5">
        <AccountAvatar id={userId} name={name} src={shown} size="xl" />

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onPick(file);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Enviando…" : shown ? "Trocar foto" : "Enviar foto"}
            </Button>

            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={onRemove}
                className="text-destructive hover:bg-destructive/10"
              >
                {removing ? "Removendo…" : "Remover"}
              </Button>
            )}
          </div>

          <p className={classes.muted}>
            Sem foto, mostramos suas iniciais em uma cor fixa.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <FormBanner tone="error">{error}</FormBanner>
        </div>
      )}
    </div>
  );
}
