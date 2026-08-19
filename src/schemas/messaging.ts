import { z } from "zod";

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Mensagem vazia.").max(5000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const togglePostingSchema = z.object({
  conversationId: z.string().uuid(),
  allowed: z.boolean(),
});
export type TogglePostingInput = z.infer<typeof togglePostingSchema>;
