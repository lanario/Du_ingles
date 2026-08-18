"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) return;

  const supabase = await createServerSupabaseClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  revalidatePath("/dashboard");
}
