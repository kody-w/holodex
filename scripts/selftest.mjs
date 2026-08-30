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

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const release = JSON.parse(fs.readFileSync(releasePath, "utf8"));
const frame = JSON.parse(fs.readFileSync(framePath, "utf8"));
const openapi = JSON.parse(
  fs.readFileSync(path.join(site, "api/openapi.json"), "utf8")
);
assert.equal(release.version, "1.1.2");
assert.equal(openapi.info.version, release.version);
assert.deepEqual(release.original_title_summary, {
  issuer_owned: 251,
  transferred: 0,
  undiscovered: 251,
  inventory_not_equity: true
});
assert.match(release.authored_holo_frame_sha256, /^[a-f0-9]{64}$/);
assert.match(release.authored_holo_frame_hash, /^[a-f0-9]{64}$/);
assert.equal(frame.organism_tiles, 251);
assert.equal(frame.control_tiles, 5);
assert.equal(frame.tiles.length, 256);
assert.equal(frame.reveal_count, 0);
assert.equal(frame.authored_holo_frame_hash, release.authored_holo_frame_hash);
assert.deepEqual(frame.dimensions, { rows: 16, columns: 16 });
assert.deepEqual(frame.original_title_summary, {
  issuer_owned: 251,
  transferred: 0,
  undiscovered: 251,
  inventory_not_equity: true
});
assert.equal(
  new Set(
    frame.tiles
      .filter((tile) => tile.kind === "holo-organism")
      .map((tile) => tile.id)
  ).size,
  251
);
assert(
  frame.tiles
    .filter((tile) => tile.kind === "holo-organism")
    .every(
      (tile) =>
        /^[a-f0-9]{64}$/.test(tile.preview.hash) &&
        tile.preview.silhouette.length >= 3 &&
        /^[a-f0-9]{64}$/.test(tile.discovery_commitment)
    )
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
  assert.equal(resource.catalog_control.legal_entity, "RapterBox LLC");
  assert.equal(resource.catalog_control.rights_status, "clearance-pending");
  assert.equal(resource.title.class, "first-edition-original");
  assert.equal(resource.title.current_holder, "RapterBox LLC");
  assert.equal(resource.title.status, "issuer-owned");
  assert.equal(resource.title.transfer_count, 0);
  assert.match(resource.preview.hash, /^[a-f0-9]{64}$/);
  assert(resource.preview.silhouette.length >= 3);
  assert(
    resource.preview.silhouette.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every(Number.isInteger)
    )
  );
  assert.equal(resource.commerce.original_title_transfer_open, false);
  assert.equal(resource.commerce.offspring_issuance_open, false);
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

const revealRequest = JSON.parse(
  fs.readFileSync(path.join(site, "api/v1/reveal-request/index.json"), "utf8")
);
assert.equal(revealRequest.state, "open");
assert.equal(revealRequest.anonymous_allowed, true);
assert.match(revealRequest.submission.fields.name, /optional/);
assert.match(revealRequest.submission.fields.email, /optional/);
assert.equal(revealRequest.promises.purchase, false);
assert.equal(revealRequest.promises.reveal, false);

const schemas = fs
  .readdirSync(path.join(site, "api/v1/schema"))
  .filter((name) => name.endsWith(".schema.json"));
assert(schemas.length >= 5);
for (const name of schemas) {
  JSON.parse(fs.readFileSync(path.join(site, "api/v1/schema", name), "utf8"));
}

for (const file of filesUnder(site)) {
  const body = fs.readFileSync(file, "utf8");
  assert(!body.includes("/Users/"), `${file} contains an absolute local path`);
  assert(!body.includes("CODE RED"), `${file} contains private strategy text`);
  assert(
    !body.includes("BEGIN PRIVATE KEY"),
    `${file} contains private signing material`
  );
}

console.log(
  `Holodex: 251 undiscovered catalog resources, 256-cell frame, ${schemas.length} schemas, release hashes valid`
);
