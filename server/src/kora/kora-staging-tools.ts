import { NodeEnv } from "@alliance/common/node-env";
import { env } from "src/config/env";

/** Deleting batches and logging completed assignments, which production never gets. */
const STAGING_TOOLS: Record<NodeEnv, boolean> = {
  [NodeEnv.Production]: false,
  [NodeEnv.Staging]: true,
  [NodeEnv.Development]: true,
  [NodeEnv.Test]: true,
};

export const koraStagingTools = (): boolean => STAGING_TOOLS[env("NODE_ENV")];
