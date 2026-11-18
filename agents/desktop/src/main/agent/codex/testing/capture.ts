import path from "node:path";
import { fileURLToPath } from "node:url";
import { CODEX_VERSION } from "../version";

const captureDir = (version: string) =>
  fileURLToPath(new URL(`./captures/${version}/`, import.meta.url));

export const captured = (name: string) =>
  path.join(captureDir(CODEX_VERSION), `${name}.jsonl`);
