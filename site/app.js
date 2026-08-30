const frameElement = document.getElementById("holo-frame");
const statusElement = document.getElementById("frame-status");
const searchElement = document.getElementById("search");
const focusId = document.getElementById("focus-id");
const focusTitle = document.getElementById("focus-title");
const focusStatus = document.getElementById("focus-status");
const focusCommitment = document.getElementById("focus-commitment");

function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = String(text);
  return value;
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
    "Source Holo sealed / Growl sealed / owner-scheduled reveal / RapterBox-owned species";
  focusCommitment.textContent = `Commitment ${resource.holo.commitment}`;
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
});
