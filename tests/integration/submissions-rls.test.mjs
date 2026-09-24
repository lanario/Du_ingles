import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";

const studentId = "11111111-1111-4111-8111-111111111111";
const otherStudentId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const otherOrganizationId = "44444444-4444-4444-8444-444444444444";
const groupId = "55555555-5555-4555-8555-555555555555";
const otherGroupId = "66666666-6666-4666-8666-666666666666";
const assignmentId = "77777777-7777-4777-8777-777777777777";

const fixture = `
  create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    'select current_setting(''test.user_id'', true)::uuid';
  create function public.auth_org() returns uuid language sql stable as
    'select current_setting(''test.organization_id'', true)::uuid';
  create function public.enrolled_in_group(uuid) returns boolean language sql stable as
    'select $1 = current_setting(''test.group_id'', true)::uuid';
  create table public.assignments (id uuid primary key, group_id uuid not null);
  create table public.assignment_submissions (
    id bigint generated always as identity primary key,
    assignment_id uuid not null,
    student_id uuid not null,
    organization_id uuid not null
  );
  alter table public.assignment_submissions enable row level security;
  grant usage on schema public, auth to authenticated;
  grant select on public.assignments to authenticated;
  grant insert on public.assignment_submissions to authenticated;
`;

test(
  "a política real só aceita entrega do aluno matriculado na organização",
  { timeout: 120_000 },
  async () => {
    const container = await new PostgreSqlContainer("postgres:17-alpine").start();
    const client = new pg.Client({ connectionString: container.getConnectionUri() });
    try {
      await client.connect();
      await client.query(fixture);
      await client.query(
        "insert into public.assignments (id, group_id) values ($1, $2)",
        [assignmentId, groupId],
      );
      const migration = await readFile(
        new URL(
          "../../supabase/migrations/20260918_submissions_insert_own_scope.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await client.query(migration);

      async function attempt({
        student = studentId,
        organization = organizationId,
        group = groupId,
      }) {
        await client.query("begin");
        try {
          await client.query("set local role authenticated");
          await client.query("select set_config('test.user_id', $1, true)", [studentId]);
          await client.query("select set_config('test.organization_id', $1, true)", [
            organizationId,
          ]);
          await client.query("select set_config('test.group_id', $1, true)", [group]);
          await client.query(
            "insert into public.assignment_submissions (assignment_id, student_id, organization_id) values ($1, $2, $3)",
            [assignmentId, student, organization],
          );
          await client.query("commit");
          return null;
        } catch (error) {
          await client.query("rollback");
          return error;
        }
      }

      assert.equal(await attempt({}), null);
      assert.equal((await attempt({ student: otherStudentId }))?.code, "42501");
      assert.equal((await attempt({ organization: otherOrganizationId }))?.code, "42501");
      assert.equal((await attempt({ group: otherGroupId }))?.code, "42501");

      const result = await client.query(
        "select count(*)::int as count from public.assignment_submissions",
      );
      assert.equal(result.rows[0].count, 1);
    } finally {
      await client.end().catch(() => {});
      await container.stop();
    }
  },
);
