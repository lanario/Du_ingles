import { z } from "zod";

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Mensagem vazia.").max(5000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const startConversationSchema = z.object({
  contactId: z.string().uuid("Selecione um contato."),
});
export type StartConversationInput = z.infer<typeof startConversationSchema>;
