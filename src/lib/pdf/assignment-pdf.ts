import "server-only";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { registerPdfFonts } from "@/lib/pdf/fonts";
import { pdfResponse, pdfSlug } from "@/lib/pdf/response";
import {
  AssignmentPdfDocument,
  type AssignmentPdfDocumentProps,
} from "@/lib/pdf/assignment-pdf-document";

/**
 * PDF de tarefa sob demanda — sem guardar no Storage como o da aula: o
 * documento é pequeno (só texto), sai em poucas centenas de ms, e assim
 * reflete sempre a versão atual da tarefa e do gabarito.
 *
 * Quem chama já autorizou o pedido; aqui é só desenhar e responder.
 */

const EMOJI = /[\p{Extended_Pictographic}‍️]/gu;

function stripEmoji(props: AssignmentPdfDocumentProps): AssignmentPdfDocumentProps {
  const clean = (s: string) => s.replace(EMOJI, "");
  return {
    ...props,
    title: clean(props.title),
    instructions: props.instructions && clean(props.instructions),
    questions: props.questions.map((q) => ({
      ...q,
      prompt: clean(q.prompt),
      options: q.options?.map(clean),
    })),
  };
}

export async function schoolNameOf(organizationId: string): Promise<string> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();
  return data?.name ?? "Du Inglês";
}

/** Nome de quem assina a tarefa no cabeçalho: o professor da turma. */
export async function groupTeacherName(groupId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("groups")
    .select("teacher:teacher_id(full_name)")
    .eq("id", groupId)
    .maybeSingle();
  return data?.teacher?.full_name || null;
}

/** Hoje, no fuso da escola — a data do PDF quando a tarefa não tem prazo. */
export function todayLabel(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export async function assignmentPdfResponse(
  props: AssignmentPdfDocumentProps,
): Promise<NextResponse> {
  registerPdfFonts();

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(AssignmentPdfDocument(props));
  } catch (error) {
    // Emojis vêm de um CDN no render; fora do ar, melhor sem emoji que sem PDF.
    console.error("[pdf] tarefa: falha no render, tentando sem emojis:", error);
    try {
      buffer = await renderToBuffer(AssignmentPdfDocument(stripEmoji(props)));
    } catch (retryError) {
      console.error("[pdf] tarefa: falha ao gerar o PDF:", retryError);
      return NextResponse.json({ error: "Falha ao gerar o PDF." }, { status: 500 });
    }
  }

  const name = `${pdfSlug(props.title, "tarefa")}${props.answerKey ? "-gabarito" : ""}.pdf`;
  return pdfResponse(buffer, name);
}
