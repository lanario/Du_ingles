import assert from "node:assert/strict";
import test from "node:test";
import { activeTeacherGroupConflict } from "../src/lib/teacher-group-conflict";
import { teacherBuckets } from "../src/components/features/admin/groups/groups-utils";

test("bloqueio do professor lista só turmas ativas e explica como resolver", () => {
  const conflict = activeTeacherGroupConflict([
    { id: "group-active", name: "Inglês B1", isActive: true },
    { id: "group-archived", name: "Inglês A2", isActive: false },
  ]);

  assert.deepEqual(conflict?.activeGroups, [{ id: "group-active", name: "Inglês B1" }]);
  assert.match(conflict?.message ?? "", /Inglês B1/);
  assert.match(conflict?.message ?? "", /reatribua cada turma a outro professor ativo/i);
  assert.match(conflict?.message ?? "", /arquive as turmas listadas/i);
  assert.equal(conflict?.message.includes("Inglês A2"), false);
  assert.equal(
    activeTeacherGroupConflict([
      { id: "group-archived", name: "Inglês A2", isActive: false },
    ]),
    null,
  );
});

test("filtro reúne apenas professores ativos com turma ativa", () => {
  const buckets = teacherBuckets(
    [
      { teacherId: "active", teacherName: "Nome antigo", isActive: true },
      { teacherId: "active", teacherName: "Nome antigo", isActive: false },
      { teacherId: "inactive", teacherName: "Inativo", isActive: true },
      { teacherId: "deleted", teacherName: "Excluído", isActive: true },
      { teacherId: "no-active-group", teacherName: "Sem turma ativa", isActive: false },
    ],
    [
      {
        id: "active",
        fullName: "Professora Ativa",
        isActive: true,
        deletedAt: null,
      },
      {
        id: "inactive",
        fullName: "Professor Inativo",
        isActive: false,
        deletedAt: null,
      },
      {
        id: "deleted",
        fullName: "Professor Excluído",
        isActive: true,
        deletedAt: "2026-10-01T00:00:00.000Z",
      },
      {
        id: "no-active-group",
        fullName: "Professora sem turma ativa",
        isActive: true,
        deletedAt: null,
      },
    ],
  );

  assert.deepEqual(buckets, [{ id: "active", name: "Professora Ativa", count: 1 }]);
});
