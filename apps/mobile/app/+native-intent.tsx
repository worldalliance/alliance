import { captureArrival } from "../lib/linkOpenings";
import { oauthReturnRedirect } from "../lib/oauthResult";

export function redirectSystemPath(params: {
  path: string;
  initial: boolean;
}): string | Promise<string> | null {
  const path = oauthReturnRedirect(params);
  return path === null
    ? null
    : captureArrival({ url: path, initial: params.initial });
}
