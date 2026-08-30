const frameElement = document.getElementById("holo-frame");
const statusElement = document.getElementById("frame-status");
const searchElement = document.getElementById("search");
const focusId = document.getElementById("focus-id");
const focusTitle = document.getElementById("focus-title");
const focusStatus = document.getElementById("focus-status");
const focusCommitment = document.getElementById("focus-commitment");
const releaseStatus = document.getElementById("release-status");

function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = String(text);
  return value;
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

function pemBytes(pem) {
  const body = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
}

function base64UrlBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function verifyRelease() {
  const response = await fetch("./api/v1/release/latest.json");
  if (!response.ok) throw new Error(`release request failed: ${response.status}`);
  const release = await response.json();
  if (release.status !== "official") {
    releaseStatus.textContent = "Candidate";
    return release;
  }
  if (!release.signature_base64url || !release.public_key_sha256) {
    throw new Error("official release is missing its signature");
  }
  const keyResponse = await fetch("./api/v1/release/public-key.pem");
  if (!keyResponse.ok) throw new Error("release public key is unavailable");
  const publicKey = await crypto.subtle.importKey(
    "spki",
    pemBytes(await keyResponse.text()),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  const unsigned = { ...release, signature_base64url: null };
  const valid = await crypto.subtle.verify(
    "Ed25519",
    publicKey,
    base64UrlBytes(release.signature_base64url),
    new TextEncoder().encode(canonicalJson(unsigned))
  );
  if (!valid) throw new Error("release signature is invalid");
  releaseStatus.textContent = "Verified";
  return release;
}

function silhouette(preview) {
  const visual = node("span", `silhouette ${preview.form}`);
  visual.style.setProperty("--phase", `${preview.phase}deg`);
  for (let index = 0; index < preview.layers; index += 1) {
    const layer = node("span");
    layer.style.setProperty("--layer", String(index + 1));
    visual.append(layer);
  }
  return visual;
}

function focus(resource, tile) {
  frameElement
    .querySelectorAll("[aria-pressed='true']")
    .forEach((selected) => selected.setAttribute("aria-pressed", "false"));
  tile.setAttribute("aria-pressed", "true");
  focusId.textContent = resource.id;
  focusTitle.textContent = "Undiscovered Holo organism";
  focusStatus.textContent =
    "Species slot published / catalog controlled by RapterBox / rights clearance pending";
  focusCommitment.textContent = `Discovery commitment ${resource.discovery.commitment}`;
}

function organismTile(resource) {
  const tile = node("button", "tile");
  tile.type = "button";
  tile.dataset.search = resource.id.toLowerCase();
  tile.setAttribute("aria-label", `${resource.id}, undiscovered Holo organism`);
  tile.append(silhouette(resource.preview.silhouette));
  tile.append(node("span", "tile-id", resource.id));
  tile.append(node("span", "tile-state", "UNDISCOVERED"));
  tile.addEventListener("click", () => focus(resource, tile));
  return tile;
}

function controlTile(control) {
  const tile = node("div", "tile control");
  tile.dataset.search = `${control.id} ${control.title} ${control.detail}`.toLowerCase();
  tile.append(node("span", "tile-id", control.id));
  tile.append(node("strong", "control-title", control.title));
  tile.append(node("span", "control-detail", control.detail));
  return tile;
}

async function main() {
  await verifyRelease();
  const response = await fetch("./api/v1/frame/first-edition.json");
  if (!response.ok) throw new Error(`frame request failed: ${response.status}`);
  const frame = await response.json();
  const resourceResponses = await Promise.all(
    frame.tiles
      .filter((tile) => tile.kind === "holo-organism")
      .map((tile) => fetch(tile.resource_url).then((result) => result.json()))
  );
  const byId = new Map(resourceResponses.map((resource) => [resource.id, resource]));
  const tiles = frame.tiles.map((tile) =>
    tile.kind === "holo-organism"
      ? organismTile(byId.get(tile.id))
      : controlTile(tile)
  );
  tiles.forEach((tile) => frameElement.append(tile));
  statusElement.textContent =
    `${frame.organism_tiles} sealed organism tiles + ${frame.control_tiles} control tiles / frame ${frame.frame_hash.slice(0, 12)}...`;

  searchElement.addEventListener("input", () => {
    const query = searchElement.value.trim().toLowerCase();
    tiles.forEach((tile) => {
      tile.classList.toggle("dimmed", Boolean(query) && !tile.dataset.search.includes(query));
    });
  });

  const firstTile = frameElement.querySelector("button.tile");
  if (firstTile) firstTile.click();
}

main().catch((error) => {
  statusElement.textContent = `Holodex refused to render: ${error.message}`;
  statusElement.style.color = "var(--cp-danger)";
  releaseStatus.textContent = "Refused";
});
