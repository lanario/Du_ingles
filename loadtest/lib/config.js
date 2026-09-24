// Configuração central lida de variáveis de ambiente. Nenhum valor aqui é
// segredo — as credenciais das contas de teste ficam em data/test-users.json
// (fora do git), não em variável de ambiente.

export const BASE_URL = (__ENV.BASE_URL || "").replace(/\/$/, "");
if (!BASE_URL || !/^https?:\/\//.test(BASE_URL)) {
  throw new Error("Defina BASE_URL com a URL explícita do ambiente a testar.");
}

export const SUPABASE_URL = __ENV.SUPABASE_URL;
export const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Defina SUPABASE_URL e SUPABASE_ANON_KEY (os mesmos valores de " +
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY do .env.local) " +
      "como variáveis de ambiente antes de rodar o teste. Ex.: " +
      "k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... loadtest/main.js",
  );
}

// Total de VUs no platô, repartido entre as jornadas (ver main.js). Comece
// baixo (ex.: 10) para o smoke test e só suba depois de validar os scripts.
export const MAX_VUS = Number(__ENV.MAX_VUS || 150);
if (!Number.isInteger(MAX_VUS) || MAX_VUS < 3) {
  throw new Error(
    "MAX_VUS deve ser um inteiro de pelo menos 3 para cobrir os três papéis.",
  );
}

export const RAMP_TIME = __ENV.RAMP_TIME || "3m";
export const HOLD_TIME = __ENV.HOLD_TIME || "5m";
export const RAMP_DOWN_TIME = __ENV.RAMP_DOWN_TIME || "2m";

// Requisições/segundo de PDF simuladas durante o platô — ver scenarios/pdf-and-reports.js.
export const PDF_RPS = Number(__ENV.PDF_RPS || 1);
if (!Number.isInteger(PDF_RPS) || PDF_RPS < 1) {
  throw new Error("PDF_RPS deve ser um inteiro positivo.");
}

// ID de uma class_session concluída com PDF já gerado (pdf_path preenchido).
// Sem isso, o cenário de PDF só exercita o /api/relatorios/export.
export const TEST_SESSION_ID_WITH_PDF = __ENV.TEST_SESSION_ID_WITH_PDF || null;
