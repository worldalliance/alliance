import { NodeEnv } from "./node-env";

export enum Features {
  GeneralUpdatesLink = "general_updates_link",
}

const PROD_FLAGS: Record<Features, boolean> = {
  [Features.GeneralUpdatesLink]: false,
};

const DEV_FLAGS: Record<Features, boolean> = {
  [Features.GeneralUpdatesLink]: true,
};

const FLAGS: Record<NodeEnv, Record<Features, boolean>> = {
  [NodeEnv.Production]: PROD_FLAGS,
  [NodeEnv.Staging]: DEV_FLAGS,
  [NodeEnv.Development]: DEV_FLAGS,
  [NodeEnv.Test]: DEV_FLAGS,
};

export const isEnabled = (feature: Features, env: NodeEnv): boolean =>
  FLAGS[env][feature];
