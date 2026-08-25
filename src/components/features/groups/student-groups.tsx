import { GroupCard } from "@/components/features/groups/group-card";
import { AccountAvatar } from "@/components/features/account/account-avatar";
import { GroupsIcon } from "@/components/ui/icons";
import type { GroupDetail } from "@/repositories/groups";
import type { ClassmateItem, StudentEnrollmentItem } from "@/repositories/enrollments";

export interface StudentGroupView {
  group: GroupDetail;
  enrollment: StudentEnrollmentItem;
  classmates: ClassmateItem[];
}

/** Professor + colegas: as únicas pessoas que o aluno enxerga da turma. */
function ClassPeople({
  group,
  classmates,
  currentStudentId,
}: {
  group: GroupDetail;
  classmates: ClassmateItem[];
  currentStudentId: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Professor
        </h4>
        <div className="mt-2 flex items-center gap-2.5">
          <AccountAvatar id={group.teacherId} name={group.teacherName} size="xs" />
          <span className="truncate text-sm font-medium text-navy-900">
            {group.teacherName}
          </span>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Colegas de turma ({classmates.length})
        </h4>
        {classmates.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Você é o único aluno matriculado nesta turma por enquanto.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {classmates.map((person) => (
              <li key={person.id} className="flex items-center gap-2.5">
                <AccountAvatar
                  id={person.id}
                  name={person.name}
                  src={person.avatarUrl}
                  size="xs"
                />
                <span className="truncate text-sm text-navy-900">{person.name}</span>
                {person.id === currentStudentId && (
                  <span className="flex-none rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    você
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Turmas na visão do aluno: só leitura. Ele vê a própria turma, os horários,
 * o professor e os colegas — nada de outras turmas da escola, matrícula,
 * troca ou edição. Por isso é um Server Component sem estado nem ação.
 */
export function StudentGroups({
  myGroups,
  currentStudentId,
}: {
  myGroups: StudentGroupView[];
  currentStudentId: string;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">
          {myGroups.length > 1 ? "Minhas turmas" : "Minha turma"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os horários da sua turma, o professor e os colegas que estudam com você.
        </p>
      </div>

      {myGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
          <GroupsIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-navy-900">
            Você ainda não está em uma turma.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Fale com a coordenação pelas Mensagens para ser matriculado.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {myGroups.map((item, index) => (
            <GroupCard
              key={item.group.id}
              group={item.group}
              index={index}
              badge={
                item.enrollment.status !== "active" ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {item.enrollment.status}
                  </span>
                ) : null
              }
            >
              <ClassPeople
                group={item.group}
                classmates={item.classmates}
                currentStudentId={currentStudentId}
              />
            </GroupCard>
          ))}
        </div>
      )}
    </div>
  );
}
