export enum Features {
  Forum = "forum",
}

export const PROD_FLAGS: Record<Features, boolean> = {
  [Features.Forum]: false,
};

export const DEV_FLAGS: Record<Features, boolean> = {
  [Features.Forum]: false,
};

export const isEnabled = (feature: Features, env: string) => {
  console.log("env", env);
  if (env === "development") {
    return DEV_FLAGS[feature];
  }
  return PROD_FLAGS[feature];
};
