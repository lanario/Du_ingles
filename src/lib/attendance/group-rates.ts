type AttendanceRow = {
  status: string;
  session: { status: string; group_id: string } | null;
};

/** Mesma regra de frequência usada no relatório: presente + atraso / aulas concluídas. */
export function groupAttendanceRates(
  rows: readonly AttendanceRow[],
): Map<string, number> {
  const counts = new Map<string, { present: number; total: number }>();
  for (const row of rows) {
    if (row.session?.status !== "completed") continue;
    const groupId = row.session.group_id;
    const current = counts.get(groupId) ?? { present: 0, total: 0 };
    current.total += 1;
    if (row.status === "present" || row.status === "late") current.present += 1;
    counts.set(groupId, current);
  }

  return new Map(
    Array.from(counts, ([groupId, count]) => [
      groupId,
      (100 * count.present) / count.total,
    ]),
  );
}
