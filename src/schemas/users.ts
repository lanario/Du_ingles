import { z } from "zod";
import { APP_ROLES } from "@/types/domain";

function isMinor(birthDate: string): boolean {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age < 18;
}

const baseFields = {
  fullName: z.string().trim().min(2, "Informe o nome completo.").max(160),
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => v || undefined),
  birthDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
};

export const createUserSchema = z
  .object({
    ...baseFields,
    role: z.enum(APP_ROLES as [string, ...string[]]),
    // Professor
    bio: z.string().trim().max(2000).optional(),
    isPublic: z.coerce.boolean().optional(),
    // Aluno
    guardianName: z
      .string()
      .trim()
      .max(160)
      .optional()
      .transform((v) => v || undefined),
    guardianEmail: z
      .string()
      .trim()
      .email("E-mail do responsável inválido.")
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    guardianPhone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .transform((v) => v || undefined),
  })
  .superRefine((data, ctx) => {
    if (data.role === "student" && data.birthDate && isMinor(data.birthDate)) {
      if (!data.guardianName || !data.guardianEmail) {
        ctx.addIssue({
          code: "custom",
          message: "Aluno menor de idade exige nome e e-mail do responsável.",
          path: ["guardianName"],
        });
      }
    }
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: baseFields.fullName,
  phone: baseFields.phone,
  birthDate: baseFields.birthDate,
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const changeUserRoleSchema = z.object({
  role: z.enum(APP_ROLES as [string, ...string[]]),
});
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
