import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(repo, "site");
const releasePath = path.join(site, "api/v1/release/latest.json");
const framePath = path.join(site, "api/v1/frame/first-edition.json");

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

const release = JSON.parse(fs.readFileSync(releasePath, "utf8"));
const frame = JSON.parse(fs.readFileSync(framePath, "utf8"));
assert.equal(frame.organism_tiles, 251);
assert.equal(frame.control_tiles, 5);
assert.equal(frame.tiles.length, 256);
assert.equal(frame.reveal_count, 0);
assert.deepEqual(frame.dimensions, { rows: 16, columns: 16 });
assert.equal(
  new Set(
    frame.tiles
      .filter((tile) => tile.kind === "holo-organism")
      .map((tile) => tile.id)
  ).size,
  251
);

for (const [relative, expected] of Object.entries(release.files)) {
  assert.equal(sha256(fs.readFileSync(path.join(site, relative))), expected, relative);
}

if (release.status === "official") {
  const publicKey = crypto.createPublicKey(
    fs.readFileSync(path.join(site, "api/v1/release/public-key.pem"))
  );
  const unsigned = { ...release, signature_base64url: null };
  assert.equal(
    crypto.verify(
      null,
      Buffer.from(canonicalJson(unsigned)),
      publicKey,
      Buffer.from(release.signature_base64url, "base64url")
    ),
    true
  );
}

const resources = fs
  .readdirSync(path.join(site, "api/v1/species"))
  .filter((name) => /^g\d{3}\.json$/.test(name));
assert.equal(resources.length, 251);
for (const name of resources) {
  const resource = JSON.parse(
    fs.readFileSync(path.join(site, "api/v1/species", name), "utf8")
  );
  assert.equal(resource.reveal.status, "undiscovered");
  assert.equal(resource.holo.status, "candidate-not-published");
  assert.equal(resource.growl.status, "candidate-not-published");
  assert.match(resource.discovery.commitment, /^[a-f0-9]{64}$/);
  assert.equal(resource.owner.legal_entity, "RapterBox LLC");
  assert.equal(resource.commerce.source_purchasable, false);
  assert.equal(resource.commerce.owner_copy_hatching_open, false);
}

const instances = JSON.parse(
  fs.readFileSync(path.join(site, "api/v1/instance/index.json"), "utf8")
);
assert.equal(instances.count, 0);

const dealers = JSON.parse(
  fs.readFileSync(path.join(site, "api/v1/dealer/index.json"), "utf8")
);
assert.equal(dealers.external_certified_count, 0);
assert.equal(dealers.direct_issuer.legal_name, "RapterBox LLC");

const schemas = fs
  .readdirSync(path.join(site, "api/v1/schema"))
  .filter((name) => name.endsWith(".schema.json"));
assert(schemas.length >= 5);
for (const name of schemas) {
  JSON.parse(fs.readFileSync(path.join(site, "api/v1/schema", name), "utf8"));
}

console.log(
  `Holodex: 251 undiscovered catalog resources, 256-cell frame, ${schemas.length} schemas, release hashes valid`
);
