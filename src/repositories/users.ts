import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateTemporaryPassword } from "@/lib/generate-password";
import type { AppRole } from "@/types/domain";
import type { CreateUserInput, UpdateUserInput } from "@/schemas/users";

export interface UserListItem {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  isActive: boolean;
  deletedAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface UserDetail extends UserListItem {
  phone: string | null;
  birthDate: string | null;
  teacherProfile: {
    bio: string | null;
    specialties: string[];
    isPublic: boolean;
  } | null;
  studentProfile: {
    currentLevel: string;
    guardianName: string | null;
    guardianEmail: string | null;
  } | null;
}

export async function listUsers(
  organizationId: string,
  filters: { role?: AppRole; search?: string; includeInactive?: boolean } = {},
): Promise<UserListItem[]> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("profiles")
    .select(
      "id, full_name, email, role, is_active, deleted_at, must_change_password, created_at",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.role) query = query.eq("role", filters.role);
  if (!filters.includeInactive) query = query.eq("is_active", true);
  if (filters.search) query = query.ilike("full_name", `%${filters.search}%`);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    deletedAt: row.deleted_at,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
  }));
}

export async function getUserById(id: string): Promise<UserDetail | null> {
  const admin = createAdminSupabaseClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, role, is_active, deleted_at, must_change_password, created_at, phone, birth_date",
    )
    .eq("id", id)
    .single();

  if (error || !profile) return null;

  let teacherProfile: UserDetail["teacherProfile"] = null;
  let studentProfile: UserDetail["studentProfile"] = null;

  if (profile.role === "teacher") {
    const { data } = await admin
      .from("teacher_profiles")
      .select("bio, specialties, is_public")
      .eq("profile_id", id)
      .single();
    if (data)
      teacherProfile = {
        bio: data.bio,
        specialties: data.specialties,
        isPublic: data.is_public,
      };
  }

  if (profile.role === "student") {
    const { data } = await admin
      .from("student_profiles")
      .select("current_level, guardian_name, guardian_email")
      .eq("profile_id", id)
      .single();
    if (data) {
      studentProfile = {
        currentLevel: data.current_level,
        guardianName: data.guardian_name,
        guardianEmail: data.guardian_email,
      };
    }
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    isActive: profile.is_active,
    deletedAt: profile.deleted_at,
    mustChangePassword: profile.must_change_password,
    createdAt: profile.created_at,
    phone: profile.phone,
    birthDate: profile.birth_date,
    teacherProfile,
    studentProfile,
  };
}

export type CreateUserResult =
  | { success: true; userId: string; tempPassword: string }
  | { success: false; message: string };

/**
 * Cria em auth.users (service-role — API não exposta ao client comum),
 * depois o profile e o subtipo (teacher_profiles/student_profiles). Se o
 * profile falhar, desfaz o auth.users criado para não deixar órfão.
 */
export async function createUser(
  input: CreateUserInput,
  organizationId: string,
): Promise<CreateUserResult> {
  const admin = createAdminSupabaseClient();
  const tempPassword = generateTemporaryPassword();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !created.user) {
    return { success: false, message: authError?.message ?? "Falha ao criar usuário." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    organization_id: organizationId,
    role: input.role as AppRole,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    birth_date: input.birthDate ?? null,
    must_change_password: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { success: false, message: "Falha ao criar o perfil do usuário." };
  }

  if (input.role === "teacher") {
    await admin.from("teacher_profiles").insert({
      profile_id: created.user.id,
      organization_id: organizationId,
      bio: input.bio ?? null,
      is_public: input.isPublic ?? false,
    });
  }

  if (input.role === "student") {
    await admin.from("student_profiles").insert({
      profile_id: created.user.id,
      organization_id: organizationId,
      guardian_name: input.guardianName ?? null,
      guardian_email: input.guardianEmail ?? null,
      guardian_phone: input.guardianPhone ?? null,
    });
  }

  return { success: true, userId: created.user.id, tempPassword };
}

export async function updateUserProfile(
  id: string,
  input: UpdateUserInput,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: input.fullName,
      phone: input.phone ?? null,
      birth_date: input.birthDate ?? null,
    })
    .eq("id", id);
  return !error;
}

export async function setUserActive(id: string, isActive: boolean): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", id);
  return !error;
}

export async function softDeleteUser(id: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function changeUserRole(id: string, role: AppRole): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
  return !error;
}

/**
 * Revoga toda sessão ativa — obrigatório após trocar papel ou desativar
 * (§3.1, §3.4). `admin.auth.admin.signOut()` do supabase-js só aceita o JWT
 * da PRÓPRIA sessão a revogar, não um user id — não existe endpoint de
 * "sign out por id" na Admin API. `revoke_user_sessions` (migration 0007)
 * apaga diretamente as linhas em `auth.sessions`, que é a via correta.
 */
export async function revokeUserSessions(id: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin.rpc("revoke_user_sessions", { p_user_id: id });
}
