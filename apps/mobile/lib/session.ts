import { R, type Result } from "@alliance/common/result";
import {
  authMe,
  type SessionTokensDto,
  type UserDto,
} from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";

export function setAuthHeader(accessToken: string | undefined): void {
  client.setConfig({
    ...client.getConfig(),
    // setConfig merges headers into the ones already set, and null is how it
    // drops one.
    headers: { Authorization: accessToken ? `Bearer ${accessToken}` : null },
  });
}

export async function openSession(params: {
  tokens: SessionTokensDto;
  saveTokens: (access: string, refresh: string) => Promise<void>;
  clearTokens: () => Promise<void>;
}): Promise<Result<UserDto, Error>> {
  const { tokens } = params;
  setAuthHeader(tokens.access_token);

  const profile = await R.fromPromise(authMe());
  const user = profile.ok ? profile.value.data?.user : undefined;
  if (!user) {
    setAuthHeader(undefined);
    return R.failure(
      new Error("Failed to fetch user profile", {
        cause: profile.ok ? undefined : profile.error,
      }),
    );
  }

  // Tokens saved before the profile loads outlive a sign-in the member was
  // told had failed, and sign them in on the next launch.
  const saved = await R.fromPromise(
    params.saveTokens(tokens.access_token, tokens.refresh_token),
  );
  if (!saved.ok) {
    setAuthHeader(undefined);
    // The access token can land without the refresh token.
    const cleared = await R.fromPromise(params.clearTokens());
    return R.failure(
      cleared.ok
        ? saved.error
        : new AggregateError(
            [saved.error, cleared.error],
            "Failed to save session tokens, then to clear them",
          ),
    );
  }
  return R.success(user);
}
