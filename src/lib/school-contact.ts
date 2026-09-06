/**
 * O contato oficial da escola, num lugar só.
 *
 * O mesmo número aparece no rodapé da landing e no botão "falar com a
 * coordenação" da área do aluno. Eram duas constantes soltas antes; quando a
 * escola trocar de número, trocar aqui basta.
 *
 * Módulo isomórfico de propósito (sem `server-only`): o botão do aluno é um
 * componente cliente.
 */

/** Só dígitos, com DDI — o formato que `wa.me` e `tel:` aceitam. */
export const SCHOOL_PHONE = "5521998122821";

/** Como o número é lido na tela. */
export const SCHOOL_PHONE_LABEL = "(21) 99812-2821";

export const SCHOOL_EMAIL = "contato@duingles.com.br";

export const SCHOOL_PHONE_HREF = `tel:+${SCHOOL_PHONE}`;
