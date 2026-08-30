import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = process.env.HOLODEX_SOURCE_DIR;
const releaseUtc = process.env.HOLODEX_RELEASE_UTC;
const baseUrl =
  process.env.HOLODEX_BASE_URL || "https://kody-w.github.io/holodex";
const releaseVersion = "1.1.2";
if (!sourceDir) throw new Error("HOLODEX_SOURCE_DIR is required");
if (!releaseUtc || new Date(releaseUtc).toISOString() !== releaseUtc) {
  throw new Error("HOLODEX_RELEASE_UTC must be an exact ISO UTC timestamp");
}
new URL(baseUrl);

const sourcePath = path.join(sourceDir, "genesis-251-reveal-policy.json");
const holoFramePath =
  process.env.HOLODEX_HOLO_FRAME ||
  path.resolve(
    sourceDir,
    "../../holo/genesis-251-first-edition-first-dimension/first-edition-frame.json"
  );
const contractDir =
  process.env.HOLODEX_CONTRACT_DIR || path.resolve(sourceDir, "..", "contracts");
const protocolDir =
  process.env.HOLODEX_PROTOCOL_DIR || path.resolve(sourceDir, "../../protocol");
const sourceBytes = fs.readFileSync(sourcePath);
const source = JSON.parse(sourceBytes);
const holoFrameBytes = fs.readFileSync(holoFramePath);
const holoFrame = JSON.parse(holoFrameBytes);
const site = path.join(repo, "site");
const api = path.join(site, "api");
const v1 = path.join(api, "v1");
const speciesDir = path.join(v1, "species");
const pageDir = path.join(speciesDir, "page");
const instanceDir = path.join(v1, "instance");
const dealerDir = path.join(v1, "dealer");
const revealRequestDir = path.join(v1, "reveal-request");
const frameDir = path.join(v1, "frame");
const releaseDir = path.join(v1, "release");
const schemaDir = path.join(v1, "schema");

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

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

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

if (source.schema !== "rappterworks-reveal-policy/1") {
  throw new Error(`unexpected source schema ${source.schema}`);
}
if (source.entries.length !== 251) {
  throw new Error(`expected 251 entries, got ${source.entries.length}`);
}
if (new Set(source.entries.map((entry) => entry.rapter_id)).size !== 251) {
  throw new Error("duplicate Rapter IDs");
}
if (source.entries.some((entry) => entry.status !== "undiscovered")) {
  throw new Error("initial public release must keep all 251 undiscovered");
}
const expectedTitleSummary = {
  issuer_owned: 251,
  transferred: 0,
  undiscovered: 251,
  inventory_not_equity: true
};
if (
  canonicalJson(source.original_title_summary) !==
  canonicalJson(expectedTitleSummary)
) {
  throw new Error("initial public release has an invalid Original title summary");
}
if (
  source.entries.some(
    (entry) =>
      entry.title_class !== "first-edition-original" ||
      entry.catalog_status !== "issuer-owned" ||
      entry.title_transfer_count !== 0 ||
      entry.original_transfer_open !== false ||
      entry.offspring_issuance_open !== false
  )
) {
  throw new Error("initial public release has an invalid per-Original title state");
}
if (
  holoFrame.schema !== "rapterbox-public-holo-frame/1" ||
  holoFrame.status !== "milestone-1-all-undiscovered" ||
  holoFrame.counts?.organisms !== 251 ||
  holoFrame.counts?.controls !== 5 ||
  holoFrame.cells?.length !== 256
) {
  throw new Error("invalid authored First Edition Holo frame");
}
const holoCells = new Map(
  holoFrame.cells
    .filter((cell) => cell.cell_type === "organism")
    .map((cell) => [cell.species_id, cell])
);
if (holoCells.size !== 251) {
  throw new Error("authored Holo frame must contain 251 unique organisms");
}

fs.rmSync(speciesDir, { recursive: true, force: true });
fs.rmSync(instanceDir, { recursive: true, force: true });
fs.rmSync(dealerDir, { recursive: true, force: true });
fs.rmSync(revealRequestDir, { recursive: true, force: true });
fs.mkdirSync(pageDir, { recursive: true });
fs.mkdirSync(revealRequestDir, { recursive: true });
fs.mkdirSync(frameDir, { recursive: true });
fs.mkdirSync(releaseDir, { recursive: true });
fs.rmSync(schemaDir, { recursive: true, force: true });
fs.mkdirSync(schemaDir, { recursive: true });

const schemaSources = new Map();
for (const directory of [contractDir, protocolDir]) {
  if (!fs.existsSync(directory)) continue;
  for (const name of fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith(".schema.json"))
    .sort()) {
    if (schemaSources.has(name)) {
      throw new Error(`duplicate public schema name ${name}`);
    }
    schemaSources.set(name, path.join(directory, name));
  }
}
const schemaFiles = [...schemaSources.keys()].sort();
for (const name of schemaFiles) {
  fs.copyFileSync(schemaSources.get(name), path.join(schemaDir, name));
}

const resources = source.entries.map((entry) => {
  const cell = holoCells.get(entry.rapter_id);
  if (
    !cell ||
    cell.cell_index !== entry.slot ||
    cell.cut.row !== Math.floor(entry.slot / 16) ||
    cell.cut.column !== entry.slot % 16 ||
    cell.discovery?.status !== "undiscovered"
  ) {
    throw new Error(`authored Holo frame mismatch for ${entry.rapter_id}`);
  }
  return {
    schema: "holodex-species/1",
    id: entry.rapter_id,
    generation: source.generation,
    slot: entry.slot,
    frame_cut: {
      ...cell.cut,
      rows: 16,
      columns: 16
    },
    reveal: {
      status: "undiscovered",
      reveal_after_utc: entry.reveal_after_utc
    },
    catalog_control: {
      legal_entity: entry.catalog_controller,
      surface: entry.controller_surface,
      status: entry.catalog_status,
      rights_status: entry.rights_status
    },
    preview: {
      kind: entry.preview_kind,
      hash: cell.shadow_preview.preview_hash,
      rotation_mdeg: cell.shadow_preview.rotation_mdeg,
      silhouette: cell.shadow_preview.silhouette
    },
    discovery: {
      commitment: cell.discovery.commitment
    },
    title: {
      class: entry.title_class,
      current_holder: entry.catalog_controller,
      holder_surface: `https://${entry.controller_surface}`,
      status: entry.catalog_status,
      transfer_count: entry.title_transfer_count
    },
    holo: {
      status: "candidate-not-published",
      commitment: null,
      resource_url: null
    },
    growl: {
      status: "candidate-not-published",
      commitment: null,
      resource_url: null
    },
    commerce: {
      original_title_transfer_open: entry.original_transfer_open,
      offspring_issuance_open: entry.offspring_issuance_open,
      job_commissions_open: false,
      spot_market_open: false,
      forecast_market_mode: "non-cash-lab-only"
    }
  };
});

for (const resource of resources) {
  writeJson(path.join(speciesDir, `${resource.id.toLowerCase()}.json`), resource);
}

const pageSize = 20;
const pages = [];
for (let offset = 0; offset < resources.length; offset += pageSize) {
  const pageNumber = Math.floor(offset / pageSize) + 1;
  const page = {
    count: resources.length,
    next:
      offset + pageSize < resources.length
        ? `${baseUrl}/api/v1/species/page/${pageNumber + 1}.json`
        : null,
    previous:
      pageNumber > 1
        ? `${baseUrl}/api/v1/species/page/${pageNumber - 1}.json`
        : null,
    results: resources.slice(offset, offset + pageSize).map((resource) => ({
      name: null,
      id: resource.id,
      status: resource.reveal.status,
      url: `${baseUrl}/api/v1/species/${resource.id.toLowerCase()}.json`
    }))
  };
  pages.push(page);
  writeJson(path.join(pageDir, `${pageNumber}.json`), page);
}

writeJson(path.join(speciesDir, "index.json"), {
  count: resources.length,
  pages: pages.length,
  page_size: pageSize,
  first: `${baseUrl}/api/v1/species/page/1.json`,
  results: pages.flatMap((page) => page.results)
});
writeJson(path.join(instanceDir, "index.json"), {
  count: 0,
  results: [],
  note: "Separately issued offspring appear here only after a rights-cleared Original and a signed issuance event. First Edition Original title remains on the species resource."
});
writeJson(path.join(dealerDir, "index.json"), {
  direct_issuer: {
    legal_name: "RapterBox LLC",
    surface: "https://rappter.com",
    status: "issuer-direct"
  },
  external_certified_count: 0,
  results: []
});
writeJson(path.join(revealRequestDir, "index.json"), {
  schema: "holodex-reveal-request/1",
  state: "open",
  purpose:
    "Signal which sealed Genesis species should be considered for a future rights-cleared reveal.",
  submission: {
    method: "POST",
    url: "https://formspree.io/f/mgawgado",
    content_type: "application/json",
    fields: {
      species_id: "string, required, G001-G251",
      first_job: "string, required",
      name: "string, optional",
      email: "string, optional",
      source: "string, set to holodex-reveal-request"
    }
  },
  anonymous_allowed: true,
  privacy:
    "Name and email may be omitted. The form processor may receive standard network metadata.",
  promises: {
    purchase: false,
    ownership: false,
    investment: false,
    reveal: false
  },
  human_view: "https://rappter.com/#reveal"
});

const controls = [
  { id: "EDITION", title: "FIRST DIMENSION", detail: "Genesis 251 / First Edition" },
  { id: "FRAME", title: "16 x 16", detail: "251 Holo organisms + 5 control cells" },
  { id: "BURN", title: "10 FRAMES", detail: "Ten mutation and market-learning epochs" },
  { id: "CONTROL", title: "251 / 251", detail: "RapterBox catalog control" },
  { id: "STATE", title: "CATALOG", detail: "Candidates not published" }
].map((control, index) => ({
  kind: "control",
  slot: 251 + index,
  row: Math.floor((251 + index) / 16),
  column: (251 + index) % 16,
  ...control
}));

const frameWithoutHash = {
  schema: "holodex-frame/1",
  generation: "genesis-251-first-dimension",
  edition: "first-edition",
  dimensions: { rows: 16, columns: 16 },
  organism_tiles: 251,
  control_tiles: 5,
  reveal_count: 0,
  authored_holo_frame_hash: holoFrame.frame_hash,
  catalog_control_summary: {
    "RapterBox LLC": 251
  },
  original_title_summary: source.original_title_summary,
  tiles: [
    ...resources.map((resource) => ({
      kind: "holo-organism",
      id: resource.id,
      slot: resource.slot,
      row: resource.frame_cut.row,
      column: resource.frame_cut.column,
      preview: resource.preview,
      discovery_commitment: resource.discovery.commitment,
      resource_url: `${baseUrl}/api/v1/species/${resource.id.toLowerCase()}.json`
    })),
    ...controls
  ]
};
const frame = {
  ...frameWithoutHash,
  frame_hash: sha256(canonicalJson(frameWithoutHash))
};
writeJson(path.join(frameDir, "first-edition.json"), frame);

writeJson(path.join(api, "openapi.json"), {
  openapi: "3.1.0",
  info: {
    title: "Holodex API",
    version: releaseVersion,
    description: "Static GET-only API for signed RapterBox Holo organism releases."
  },
  servers: [{ url: baseUrl }],
  paths: {
    "/api/v1/species/index.json": {
      get: { summary: "List every canonical Holodex species resource" }
    },
    "/api/v1/species/{id}.json": {
      get: {
        summary: "Read one canonical Holo species resource",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", pattern: "^g[0-9]{3}$" }
          }
        ]
      }
    },
    "/api/v1/instance/index.json": {
      get: { summary: "List publicly indexed player-owned instances" }
    },
    "/api/v1/dealer/index.json": {
      get: { summary: "List current RapterBox certified dealers" }
    },
    "/api/v1/reveal-request/index.json": {
      get: { summary: "Read the optional-contact species reveal-request contract" }
    },
    "/api/v1/frame/first-edition.json": {
      get: { summary: "Read the complete First Edition 16 by 16 frame" }
    },
    "/api/v1/release/latest.json": {
      get: { summary: "Read and verify the latest release stamp" }
    },
    "/api/v1/schema/{name}.schema.json": {
      get: {
        summary: "Read one public Holodex application schema",
        parameters: [
          {
            name: "name",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ]
      }
    }
  }
});

const releaseFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "api/openapi.json",
  "api/v1/species/index.json",
  "api/v1/instance/index.json",
  "api/v1/dealer/index.json",
  "api/v1/reveal-request/index.json",
  "api/v1/frame/first-edition.json",
  ...resources.map((resource) => `api/v1/species/${resource.id.toLowerCase()}.json`),
  ...pages.map((_, index) => `api/v1/species/page/${index + 1}.json`),
  ...schemaFiles.map((name) => `api/v1/schema/${name}`)
];
const hashes = Object.fromEntries(
  releaseFiles.map((relative) => [
    relative,
    sha256(fs.readFileSync(path.join(site, relative)))
  ])
);
const manifest = {
  schema: "holodex-release/1",
  status: "candidate",
  release: "genesis-251-first-edition",
  version: releaseVersion,
  publisher: "RapterBox LLC",
  authority: "https://rappter.com",
  issued_at_utc: releaseUtc,
  source_sha256: sha256(sourceBytes),
  authored_holo_frame_sha256: sha256(holoFrameBytes),
  authored_holo_frame_hash: holoFrame.frame_hash,
  frame_sha256: frame.frame_hash,
  organism_count: 251,
  revealed_count: 0,
  schema_count: schemaFiles.length,
  catalog_control: {
    "RapterBox LLC": 251
  },
  original_title_summary: source.original_title_summary,
  files: hashes,
  public_key_sha256: null,
  signature_algorithm: "Ed25519",
  signature_base64url: null
};
writeJson(path.join(releaseDir, "latest.json"), manifest);

console.log(`Built Holodex with ${resources.length} undiscovered catalog resources.`);
console.log(`Frame ${frame.frame_hash}`);
