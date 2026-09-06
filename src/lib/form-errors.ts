/**
 * Resumo de erro de formulário. "Dados inválidos" e "Verifique os campos"
 * mandam a pessoa reler tudo; aqui a frase nomeia os campos recusados usando
 * exatamente o rótulo que está na tela, e a mensagem de cada campo (embaixo
 * dele) diz o que fazer.
 *
 * A lista de rótulos vem do schema do formulário, na ordem em que os campos
 * aparecem — o resumo lê como a tela, de cima para baixo.
 */

export type FieldLabels = ReadonlyArray<readonly [string, string]>;

export function invalidFieldLabels(
  fields: Record<string, string[] | undefined> | undefined,
  labels: FieldLabels,
): string[] {
  if (!fields) return [];
  return labels.filter(([name]) => fields[name]?.length).map(([, label]) => label);
}

export function describeInvalidFields(
  fields: Record<string, string[] | undefined> | undefined,
  labels: FieldLabels,
): string {
  const invalid = invalidFieldLabels(fields, labels);

  if (invalid.length === 0) return "Verifique os campos do formulário.";
  if (invalid.length === 1) return `Corrija o campo ${invalid[0]}.`;

  const last = invalid[invalid.length - 1];
  return `Corrija os campos ${invalid.slice(0, -1).join(", ")} e ${last}.`;
}
