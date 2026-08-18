import { z } from "zod";

export const enterViewAsSchema = z.object({
  targetTeacherId: z.string().uuid().optional(),
});
export type EnterViewAsInput = z.infer<typeof enterViewAsSchema>;
