import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const privateKeyPath = process.env.HOLODEX_SIGNING_KEY;
if (!privateKeyPath) throw new Error("HOLODEX_SIGNING_KEY is required");

const releasePath = path.join(repo, "site/api/v1/release/latest.json");
const publicKeyPath = path.join(repo, "site/api/v1/release/public-key.pem");
const manifest = JSON.parse(fs.readFileSync(releasePath, "utf8"));

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

const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath));
const publicKey = crypto.createPublicKey(privateKey);
const publicPem = publicKey.export({ type: "spki", format: "pem" });
const publicKeySha256 = crypto
  .createHash("sha256")
  .update(publicPem)
  .digest("hex");
const unsigned = {
  ...manifest,
  status: "official",
  public_key_sha256: publicKeySha256,
  signature_base64url: null
};
const signature = crypto.sign(
  null,
  Buffer.from(canonicalJson(unsigned)),
  privateKey
);
const signed = {
  ...unsigned,
  signature_base64url: signature.toString("base64url")
};
fs.writeFileSync(publicKeyPath, publicPem);
fs.writeFileSync(releasePath, `${JSON.stringify(signed, null, 2)}\n`);
console.log(`Signed ${releasePath}`);
console.log(`Public key ${publicKeySha256}`);
