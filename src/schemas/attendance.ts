import { z } from "zod";

export const attendanceEntrySchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(["present", "absent", "late", "excused"]),
});

export const recordAttendanceSchema = z.object({
  entries: z.array(attendanceEntrySchema).min(1),
});
export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
