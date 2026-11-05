export interface ActiveTeacherGroup {
  id: string;
  name: string;
}

interface TeacherGroupStatus extends ActiveTeacherGroup {
  isActive: boolean;
}

export interface ActiveTeacherGroupConflict {
  activeGroups: ActiveTeacherGroup[];
  message: string;
}

/** Describe the active groups that must be reassigned or archived first. */
export function activeTeacherGroupConflict(
  groups: readonly TeacherGroupStatus[],
): ActiveTeacherGroupConflict | null {
  const activeGroups = groups
    .filter((group) => group.isActive)
    .map(({ id, name }) => ({ id, name }));

  if (activeGroups.length === 0) return null;

  const groupNames = activeGroups.map((group) => `“${group.name}”`).join(", ");
  const groupLabel = activeGroups.length === 1 ? "uma turma ativa" : "turmas ativas";

  return {
    activeGroups,
    message: `Não é possível desativar, excluir ou alterar o papel deste professor enquanto ele ainda responde por ${groupLabel}: ${groupNames}. Reatribua cada turma a outro professor ativo ou arquive as turmas listadas antes de tentar novamente.`,
  };
}
