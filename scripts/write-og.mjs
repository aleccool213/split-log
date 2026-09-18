import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const b64 = readFileSync(join(dir, "og-card.b64"), "utf8").replace(/\s+/g, "");
writeFileSync(join(dir, "../public/og.png"), Buffer.from(b64, "base64"));
