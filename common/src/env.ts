import { z } from "zod";
import { R, type Result } from "./result";

export type EnvSource = Record<string, unknown>;

const missing = "missing";
export const missingSuffix = `: ${missing}`;

// A deploy expands a secret that was never set to an empty string.
const unsetIfBlank = (value: unknown): unknown =>
  typeof value === "string" && !value.trim() ? undefined : value;

export const requiredEnv = <T extends z.ZodType>(schema: T) =>
  z
    .preprocess(unsetIfBlank, schema)
    .refine((value) => presentValue(value) !== undefined, missing);

export const optionalEnv = <T extends z.ZodType>(schema: T) =>
  z.preprocess(unsetIfBlank, schema.optional());

// z.url() alone accepts a scheme-less `localhost:7273`, parsed as scheme `localhost:`.
export const httpUrl = z.url({ protocol: /^https?$/ });

export const envFlag = z
  .preprocess(unsetIfBlank, z.enum(["1", "true", "0", "false"]).optional())
  .transform((value) => value === "1" || value === "true");

function describe(params: {
  key: string;
  source: EnvSource;
  message: string;
}): string {
  const raw = unsetIfBlank(params.source[params.key]);
  return `${params.key}: ${raw === undefined ? missing : params.message}`;
}

type EnvFields = Record<string, z.ZodType>;

// A list set to "," parses to [], as unusable as unset.
function presentValue<T>(value: T): NonNullable<T> | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return Array.isArray(value) && !value.length ? undefined : value;
}

const invalidEnv = (problem: string) =>
  new Error(`Invalid environment: ${problem}`);

export function readEnvKey<F extends EnvFields, K extends keyof F>(params: {
  fields: F;
  key: K & string;
  source: EnvSource;
}): z.output<F[K]> {
  const parsed = params.fields[params.key].safeParse(params.source[params.key]);
  if (parsed.success) return parsed.data;
  throw invalidEnv(
    describe({ ...params, message: parsed.error.issues[0].message }),
  );
}

export function requireEnvKey<F extends EnvFields, K extends keyof F>(
  params: Parameters<typeof readEnvKey<F, K>>[0],
): NonNullable<z.output<F[K]>> {
  const value = presentValue(readEnvKey(params));
  if (value === undefined) {
    throw invalidEnv(`${params.key}${missingSuffix}`);
  }
  return value;
}

/**
 * The parsed config, or a line per problem, each naming its key. Each field
 * parses on its own, so one bad field hides no other problem. `requiredKeys`
 * sees the fields that parsed; a key it names is missing when unset, even
 * where its field has a default.
 */
export function parseEnv<F extends EnvFields>(params: {
  fields: F;
  source: EnvSource;
  requiredKeys?: (config: {
    [K in keyof F]?: z.output<F[K]>;
  }) => Iterable<keyof F & string>;
}): Result<z.output<z.ZodObject<F>>, string[]> {
  const config: { [K in keyof F]?: z.output<F[K]> } = {};
  const problems: string[] = [];
  for (const key in params.fields) {
    const parsed = params.fields[key].safeParse(params.source[key]);
    if (parsed.success) config[key] = parsed.data;
    else {
      problems.push(
        ...parsed.error.issues.map((issue) =>
          describe({ key, source: params.source, message: issue.message }),
        ),
      );
    }
  }
  for (const key of new Set(params.requiredKeys?.(config))) {
    if (!(key in config)) continue;
    const unset = unsetIfBlank(params.source[key]) === undefined;
    if (unset || presentValue(config[key]) === undefined) {
      problems.push(`${key}${missingSuffix}`);
    }
  }
  if (problems.length) return R.failure(problems);
  // With no problems, every field parsed into `config`.
  return R.success(config as z.output<z.ZodObject<F>>);
}

/** `source` over `fallback`; a blank value in `source` is unset, so the
 * fallback shows through it. */
export function envWithFallback(params: {
  source: EnvSource;
  fallback: EnvSource;
}): EnvSource {
  const merged = { ...params.fallback };
  for (const [key, value] of Object.entries(params.source)) {
    if (unsetIfBlank(value) !== undefined) merged[key] = value;
  }
  return merged;
}

export function formatEnvProblems(params: {
  heading: string;
  problems: string[];
}): string {
  return `${params.heading}:\n${params.problems.map((line) => `  ${line}`).join("\n")}`;
}
