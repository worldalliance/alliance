import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const sourceConfigSchema = z.object({
  path: z.array(z.string()),
  ignore: z.array(z.string()).default([]),
});

export type SourceConfig = z.infer<typeof sourceConfigSchema>;

const SOURCE_FILE = /\.(ts|tsx|js|jsx)$/;

export function readSourceConfig(repoRoot: string): SourceConfig {
  return sourceConfigSchema.parse(
    JSON.parse(fs.readFileSync(path.join(repoRoot, ".jscpd.json"), "utf8")),
  );
}

export function scannedFiles(config: SourceConfig, files: string[]): string[] {
  const ignores = config.ignore.map((pattern) => new Bun.Glob(pattern));
  return files.filter(
    (file) =>
      SOURCE_FILE.test(file) && !ignores.some((glob) => glob.match(file)),
  );
}
