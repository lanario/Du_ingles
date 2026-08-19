import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/domain";
import type { UpdateUserInput } from "@/schemas/users";

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
    guardianPhone: string | null;
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
      .select("current_level, guardian_name, guardian_email, guardian_phone")
      .eq("profile_id", id)
      .single();
    if (data) {
      studentProfile = {
        currentLevel: data.current_level,
        guardianName: data.guardian_name,
        guardianEmail: data.guardian_email,
        guardianPhone: data.guardian_phone,
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

/** Papel + organização do alvo — o mínimo para autorizar uma ação de admin sobre ele. */
export async function getUserRoleAndOrg(
  id: string,
): Promise<{ role: AppRole; organizationId: string } | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("profiles")
    .select("role, organization_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return { role: data.role, organizationId: data.organization_id };
}

/**
 * Troca a senha de OUTRA pessoa. Só a Admin API consegue isso: o
 * `updateUser` do cliente normal age sobre a sessão de quem chama. Marca
 * `must_change_password` para que a senha definida pelo admin seja apenas
 * provisória — no próximo login o dono da conta escolhe a dele.
 */
export async function setUserPassword(id: string, password: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return false;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", id);
  return !profileError;
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

/**
 * Nome do próprio usuário logado. Passa pela RLS normal
 * (`profiles_select_self`) — não precisa de admin client, e a mesma função
 * serve professor e aluno.
 */
export async function getMyDisplayName(userId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  return data?.full_name ?? null;
}
