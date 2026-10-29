export enum Features {
  GeneralUpdatesLink = "general_updates_link",
}

export const PROD_FLAGS: Record<Features, boolean> = {
  [Features.GeneralUpdatesLink]: false,
};

export const DEV_FLAGS: Record<Features, boolean> = {
  [Features.GeneralUpdatesLink]: true,
};

export const isEnabled = (feature: Features, env: string) => {
  if (env === "development" || env === "staging") {
    return DEV_FLAGS[feature];
  }
  return PROD_FLAGS[feature];
};
