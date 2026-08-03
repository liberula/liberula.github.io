import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function filesBelow(relative) {
  const root = new URL(`../${relative}/`, import.meta.url);
  const found = [];
  async function visit(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await visit(new URL(`${entry.name}/`, directory), `${name}/`);
      else found.push({ name: `${relative}/${name}`, url: new URL(entry.name, directory) });
    }
  }
  await visit(root);
  return found;
}

test("all ECO-SP-001 address references use the corrected street number", async () => {
  const obsoleteNumber = String(190 + 6);
  const candidates = [
    ...(await filesBelow("app/eco/eco-sp-001")),
    ...(await filesBelow("supabase/functions/eco-sp-001-api")),
    ...(await filesBelow("docs")),
    ...(await filesBelow("tests")),
  ].filter(({ name }) =>
    !name.endsWith("eco-sp-001-canonical-address.test.mjs") &&
    /\.(?:ts|tsx|mjs|md|json)$/.test(name)
  );
  const offenders = [];
  for (const file of candidates) {
    const source = await readFile(file.url, "utf8");
    if (new RegExp(`\\b${obsoleteNumber}\\b`).test(source)) offenders.push(file.name);
  }
  assert.deepEqual(offenders, []);
});

test("the corrected address is revealed after success and its server aliases are documented", async () => {
  const api = await readFile(
    new URL("../supabase/functions/eco-sp-001-api/index.ts", import.meta.url),
    "utf8",
  );
  const handoff = await readFile(
    new URL("../docs/eco-sp-001-backend-handoff.md", import.meta.url),
    "utf8",
  );
  const reveal = await readFile(
    new URL("../app/eco/eco-sp-001/PostSolveReveal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(api, /return json\(200, \{ correct \}, origin\)/);
  assert.match(reveal, /Rua Benjamin Constant, 200/);
  for (const alias of [
    "Rua Benjamin Constant 200",
    "R. Benjamin Constant 200",
    "Benjamin Constant 200",
    "Rua Benjamin Constant 200 Sé São Paulo",
  ]) assert.ok(handoff.includes(alias), alias);
});
