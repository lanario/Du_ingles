"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { setNewPasswordSchema } from "@/schemas/auth";
import { fail, type ActionResult } from "@/types/action-result";

/**
 * Usado tanto pelo fluxo forçado de primeiro acesso (`/definir-senha`)
 * quanto pelo link de recuperação (`/redefinir-senha`) — em ambos os casos
 * o usuário já chega com uma sessão válida (normal ou de recovery).
 */
export async function setNewPasswordAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = setNewPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail("UNAUTHENTICATED", "Sessão expirada. Solicite um novo link.");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail("INTERNAL_ERROR", "Não foi possível atualizar a senha. Tente novamente.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id)
    .select("role")
    .single();

  redirect(profile?.role === "admin" ? "/admin" : "/dashboard");
}
