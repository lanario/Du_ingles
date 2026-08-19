import type { Database } from "@/types/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type CefrLevel = Database["public"]["Enums"]["cefr_level"];
export type SessionStatus = Database["public"]["Enums"]["session_status"];
export type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];
export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
export type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];
export type FinanceEntryKind = Database["public"]["Enums"]["finance_entry_kind"];

export const APP_ROLES: readonly AppRole[] = ["admin", "teacher", "student"];
export const CEFR_LEVELS: readonly CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const FINANCE_ENTRY_KINDS: readonly FinanceEntryKind[] = [
  "revenue",
  "professional_cost",
  "operating_expense",
];
