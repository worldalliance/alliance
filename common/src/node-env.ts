import { z } from "zod";
import { R, type Result } from "./result";

export enum NodeEnv {
  Production = "production",
  Staging = "staging",
  Development = "development",
  Test = "test",
}

const nodeEnvSchema = z.enum(NodeEnv);

const IS_DEPLOYED: Record<NodeEnv, boolean> = {
  [NodeEnv.Production]: true,
  [NodeEnv.Staging]: true,
  [NodeEnv.Development]: false,
  [NodeEnv.Test]: false,
};

export function isDeployed(env: NodeEnv): boolean {
  return IS_DEPLOYED[env];
}

export function parseNodeEnv(
  value: string | undefined,
): Result<NodeEnv, Error> {
  const parsed = nodeEnvSchema.safeParse(value);

  return parsed.success
    ? R.success(parsed.data)
    : R.failure(
        new Error(
          `NODE_ENV=${value ?? "<unset>"} (expected one of ${Object.values(NodeEnv).join(", ")})`,
        ),
      );
}

export function currentNodeEnv(): Result<NodeEnv, Error> {
  return parseNodeEnv(process.env.NODE_ENV);
}
