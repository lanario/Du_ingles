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

/**
 * Canal do encarregado pelo tratamento de dados (LGPD art. 41 §1: identidade e
 * contato divulgados publicamente). Enquanto a escola não nomeia um
 * encarregado com endereço próprio, as solicitações de titulares chegam pelo
 * contato geral — trocar aqui quando houver.
 */
export const PRIVACY_CONTACT_EMAIL = SCHOOL_EMAIL;

/**
 * Identificação de quem presta o serviço. O Decreto nº 7.962/2013 (art. 2º)
 * exige nome empresarial, CNPJ e endereço físico em destaque em quem contrata
 * pela internet, e a LGPD pede a identidade do controlador (art. 9º, III).
 *
 * Preencha com os dados do contrato social. Enquanto vazios, os termos e a
 * política mostram só o nome fantasia e os contatos — o que NÃO atende o
 * decreto; não publique a versão final assim.
 */
export const SCHOOL_LEGAL_NAME = "";
export const SCHOOL_CNPJ = "";
export const SCHOOL_ADDRESS = "";
