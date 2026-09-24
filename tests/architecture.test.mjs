import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const sourceRoot = path.resolve("src");
const extensions = new Set([".ts", ".tsx"]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(fullPath);
      return entry.isFile() && extensions.has(path.extname(entry.name)) ? [fullPath] : [];
    }),
  );
  return nested.flat();
}

function importedModules(source) {
  const modules = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      modules.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      modules.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return modules;
}

function targetPath(file, specifier) {
  if (specifier.startsWith("@/")) return specifier.slice(2);
  if (!specifier.startsWith(".")) return null;
  const resolved = path.resolve(path.dirname(file), specifier);
  if (!resolved.startsWith(`${sourceRoot}${path.sep}`)) return null;
  return path.relative(sourceRoot, resolved).replaceAll(path.sep, "/");
}

const rules = [
  {
    source: "schemas/",
    forbidden: ["app/", "components/", "repositories/", "services/"],
  },
  { source: "repositories/", forbidden: ["app/", "components/", "services/"] },
  { source: "services/", forbidden: ["app/", "components/"] },
];

test("camadas internas não dependem de camadas superiores", async () => {
  const violations = [];
  for (const file of await sourceFiles(sourceRoot)) {
    const relative = path.relative(sourceRoot, file).replaceAll(path.sep, "/");
    const rule = rules.find(({ source }) => relative.startsWith(source));
    if (!rule) continue;
    const source = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const specifier of importedModules(source)) {
      const target = targetPath(file, specifier);
      if (target && rule.forbidden.some((prefix) => target.startsWith(prefix))) {
        violations.push(`${relative} -> ${target}`);
      }
    }
  }
  assert.deepEqual(violations, [], `Dependências proibidas:\n${violations.join("\n")}`);
});
