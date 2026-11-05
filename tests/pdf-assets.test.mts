import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// assets.ts importa "server-only", que só carrega com a condição react-server:
// o corpo real roda num processo filho com essa condição.
if (!process.env["PDF_ASSETS_CHILD"]) {
  test("pdf assets (processo com react-server)", () => {
    const r = spawnSync(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", "tests/pdf-assets.test.mts"],
      {
        env: {
          ...process.env,
          PDF_ASSETS_CHILD: "1",
          NODE_TEST_CONTEXT: "",
          // env.ts valida na importação; valores fictícios, nada é acessado.
          NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
          NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        },
        encoding: "utf8",
      },
    );
    const out = r.stdout + r.stderr;
    assert.equal(r.status, 0, out);
    assert.match(out, /fail\D+0\b/, out);
  });
} else {
  const { resolveAssetPath, fetchBytes, isPrivateHost } = await import("../src/lib/pdf/assets");
  const realFetch = globalThis.fetch;

  const U = "123e4567-e89b-42d3-a456-426614174000";
  test("resolveAssetPath: relativo e absoluto do app viram caminho de asset", () => {
    assert.equal(resolveAssetPath(`/api/lesson-assets/org1/plano-a/${U}.png?x=1`), `org1/plano-a/${U}.png`);
    assert.equal(
      resolveAssetPath(`https://qualquer.host/api/lesson-assets/org1/geral/${U}.jpg`),
      `org1/geral/${U}.jpg`,
    );
    assert.equal(resolveAssetPath("https://example.com/foto.png"), null);
    assert.equal(resolveAssetPath(`https://example.com/x/api/lesson-assets/org1/a/${U}.png`), null);
  });

  test("resolveAssetPath: traversal, barra codificada, segmento vazio e formato inválido → null", () => {
    const base = "/api/lesson-assets/";
    for (const bad of [
      `org1%2f..%2f..%2fother/a/${U}.png`,
      `org1/a%2f..%2f${U}.png`,
      `org1%5c..%5cx/a/${U}.png`,
      `org1//${U}.png`,
      `org1/a//${U}.png`,
      `org1/../x/${U}.png`,
      `org1/a/${U}.png%00`,
      `org1/a/b.png`,
      `org1/${U}.png`,
      `%`,
    ]) {
      assert.equal(resolveAssetPath(base + bad), null, bad);
    }
  });

  test("fetchBytes: corpo sem content-length acima do teto → null", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream({
          pull(c) {
            c.enqueue(chunk); // infinito: sem teto, o teste penduraria
          },
        }),
      )) as typeof fetch;
    try {
      assert.equal(await fetchBytes("https://a.example.com/big.png"), null);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("isPrivateHost: CGNAT, benchmark e IETF", () => {
    for (const h of ["100.64.0.1", "100.127.255.1", "198.18.0.1", "198.19.1.1", "192.0.0.5"]) {
      assert.equal(isPrivateHost(`http://${h}/x`), true, h);
    }
    assert.equal(isPrivateHost("http://100.128.0.1/x"), false);
  });

  test("isPrivateHost: ponto final não escapa", () => {
    for (const h of ["localhost.", "foo.internal.", "10.0.0.1.", "LOCALHOST..", "a.localhost."]) {
      assert.equal(isPrivateHost(`http://${h}/x`), true, h);
    }
    assert.equal(isPrivateHost("http://cdn.example.com./x"), false);
  });

  test("fetchBytes: resposta não-ok cancela o corpo e devolve null", async () => {
    let cancelled = false;
    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream({
          pull(c) {
            c.enqueue(new Uint8Array(8));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { status: 404 },
      )) as typeof fetch;
    try {
      assert.equal(await fetchBytes("https://a.example.com/x.png"), null);
      assert.equal(cancelled, true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("fetchBytes: segue redirect público", async () => {
    globalThis.fetch = (async (u: string) =>
      String(u).includes("a.example.com")
        ? new Response(null, { status: 301, headers: { location: "https://b.example.com/i.png" } })
        : new Response(new Uint8Array([1, 2, 3]))) as typeof fetch;
    try {
      const out = await fetchBytes("https://a.example.com/i.png");
      assert.equal(out?.byteLength, 3);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("fetchBytes: redirect para host privado é rejeitado", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/x" } });
    }) as typeof fetch;
    try {
      assert.equal(await fetchBytes("https://a.example.com/i.png"), null);
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("fetchBytes: mais de 3 saltos falha", async () => {
    globalThis.fetch = (async () =>
      new Response(null, { status: 302, headers: { location: "https://a.example.com/n" } })) as typeof fetch;
    try {
      assert.equal(await fetchBytes("https://a.example.com/i.png"), null);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
}
