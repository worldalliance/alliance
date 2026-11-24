import { NodeEnv } from "./node-env";

export enum Features {
  GeneralUpdatesLink = "general_updates_link",
  /** Deleting Kora batches and logging completed assignments. */
  KoraStagingTools = "kora_staging_tools",
}

const PROD_FLAGS: Record<Features, boolean> = {
  [Features.GeneralUpdatesLink]: false,
  [Features.KoraStagingTools]: false,
};

const DEV_FLAGS: Record<Features, boolean> = {
  [Features.GeneralUpdatesLink]: true,
  [Features.KoraStagingTools]: true,
};

const FLAGS: Record<NodeEnv, Record<Features, boolean>> = {
  [NodeEnv.Production]: PROD_FLAGS,
  [NodeEnv.Staging]: DEV_FLAGS,
  [NodeEnv.Development]: DEV_FLAGS,
  [NodeEnv.Test]: DEV_FLAGS,
};

export const isEnabled = (feature: Features, env: NodeEnv): boolean =>
  FLAGS[env][feature];
