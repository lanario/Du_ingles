import type { Instrumentation } from "next";

/** Erros não tratados por rota, sem URL completa, cabeçalhos ou dados do usuário. */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  console.error(
    JSON.stringify({
      event: "server_request_error",
      route: context.routePath,
      routeType: context.routeType,
      digest,
    }),
  );
};
