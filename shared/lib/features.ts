export enum Features {
  Forum = "forum",
}

export const PROD_FLAGS: Record<Features, boolean> = {
  [Features.Forum]: true,
};

export const DEV_FLAGS: Record<Features, boolean> = {
  [Features.Forum]: true,
};

export const isEnabled = (feature: Features, env: string) => {
  if (env === "development") {
    return DEV_FLAGS[feature];
  }
  return PROD_FLAGS[feature];
};
