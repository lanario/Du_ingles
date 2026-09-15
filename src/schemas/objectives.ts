import { z } from "zod";

export const objectiveFieldsSchema = z.object({
  title: z.string().trim().min(2, "Informe um título.").max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
});
export type ObjectiveFieldsInput = z.infer<typeof objectiveFieldsSchema>;
