# Holodex

Holodex is the consumption-only public API and frame viewer for RapterBox Holo
species slots and cleared releases.

The First Edition / First Dimension is one 16 by 16 Holo frame:

- 251 signed canonical species slots with authored shadow previews;
- 5 frame/control/provenance tiles;
- 0 revealed organisms at initial publication;
- 251 of 251 catalog slots controlled by RapterBox LLC through `rappter.com`;
  candidate source-content rights remain clearance-pending.

Each tile is a generation-bound cut of the edition frame. Before clearance, it
contains only a discovery commitment and shadow preview. A later signed reveal
may publish the cleared source Holo and original piano Growl. Players then hatch
uniquely owned instances from that species; each instance receives its own
dimension branch and can diverge through personal lens frames.

## Public API

```text
GET /api/v1/species/index.json
GET /api/v1/species/page/1.json
GET /api/v1/species/g001.json
GET /api/v1/instance/index.json
GET /api/v1/dealer/index.json
GET /api/v1/frame/first-edition.json
GET /api/v1/release/latest.json
GET /api/v1/schema/dogg-market-profile.schema.json
GET /api/openapi.json
```

The API is static, unauthenticated, GET-only, and suitable for local caching.

## Build

```bash
HOLODEX_SOURCE_DIR=/path/to/rapterbox/shopify/data \
HOLODEX_RELEASE_UTC=2026-08-29T21:00:00.000Z \
HOLODEX_BASE_URL=https://kody-w.github.io/holodex \
npm run build
npm test
```

## Sign

The release private key must remain outside every repository.

```bash
HOLODEX_SIGNING_KEY=~/.rapterbox/keys/holodex-release-ed25519.pem npm run sign
npm test
```

## Publish

GitHub Pages deploys only the `site/` directory. The custom domain is prepared
for `holodex.rappter.com` but should be enabled only after its DNS record exists.

## Licensing

- Site and API code: MIT.
- Public metadata: CC BY 4.0.
- Holo organisms, Growls, names, marks, and sealed/revealed media:
  copyright RapterBox LLC; rights travel only through the signed ownership and
  license records.
