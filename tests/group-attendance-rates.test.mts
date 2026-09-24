import assert from "node:assert/strict";
import test from "node:test";
import { groupAttendanceRates } from "../src/lib/attendance/group-rates";

test("frequência considera só aulas concluídas e conta atrasos como presença", () => {
  const rates = groupAttendanceRates([
    { status: "present", session: { status: "completed", group_id: "a" } },
    { status: "late", session: { status: "completed", group_id: "a" } },
    { status: "absent", session: { status: "completed", group_id: "a" } },
    { status: "absent", session: { status: "scheduled", group_id: "a" } },
    { status: "absent", session: { status: "completed", group_id: "b" } },
    { status: "present", session: null },
  ]);

  assert.equal(rates.get("a"), 200 / 3);
  assert.equal(rates.get("b"), 0);
  assert.equal(rates.has("c"), false);
});
