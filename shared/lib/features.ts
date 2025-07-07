export enum Features {
  Forum = "forum",
  PublicSignup = "public_signup",
}

export const PROD_FLAGS: Record<Features, boolean> = {
  [Features.Forum]: false,
  [Features.PublicSignup]: false,
};

export const DEV_FLAGS: Record<Features, boolean> = {
  [Features.Forum]: false,
  [Features.PublicSignup]: true,
};

export const isEnabled = (feature: Features, env: string) => {
  if (env === "development") {
    return DEV_FLAGS[feature];
  }
  return PROD_FLAGS[feature];
};
