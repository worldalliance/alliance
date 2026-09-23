import {
  MOBILE_OAUTH_RETURN_URL,
  OAuthError,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { afterAll, describe, expect, it, mock, spyOn } from "bun:test";
import { FetchError } from "expo/src/winter/fetch/FetchErrors";
import { ClientFailure } from "./oauthResult";
import {
  signInWithProvider,
  type NativeCredential,
  type NativeSignIn,
} from "./oauthSignIn";

const consoleError = spyOn(console, "error").mockImplementation(() => {});

afterAll(() => {
  consoleError.mockRestore();
});

const api = serveApi(routes({}));

const session = { access_token: "a", refresh_token: "r" };
const returnLink = (query: string) => `${MOBILE_OAUTH_RETURN_URL}?${query}`;

function native(params: {
  credential: Result<NativeCredential, OAuthError> | null;
  returned?: Result<string, OAuthError>;
}) {
  const openBrowserSession = mock<NativeSignIn["openBrowserSession"]>(
    async () => params.returned ?? R.failure(OAuthError.Cancelled),
  );
  const credential = async () => params.credential;
  return {
    openBrowserSession,
    native: {
      credential: {
        [OAuthProvider.Google]: credential,
        [OAuthProvider.Apple]: credential,
      },
      openBrowserSession,
    },
  };
}

const signIn = (nativeSignIn: NativeSignIn) =>
  signInWithProvider({
    provider: OAuthProvider.Apple,
    guestToken: "guest",
    native: nativeSignIn,
  });

describe("with a native sheet", () => {
  it("sends the identity token with the guest token", async () => {
    const sent = mock();
    api.throwingOnRefusal({
      "POST /auth/:provider/native": async ({ request, params }) => {
        sent({ provider: params.provider, body: await request.json() });
        return Response.json({ session });
      },
    });

    const device = native({ credential: R.success({ identityToken: "t" }) });
    expect(await signIn(device.native)).toEqual(R.success(session));
    expect(sent).toHaveBeenCalledWith({
      provider: OAuthProvider.Apple,
      body: { identityToken: "t", guestToken: "guest" },
    });
    expect(device.openBrowserSession).not.toHaveBeenCalled();
  });

  it("stops at a cancelled sheet", async () => {
    api.throwingOnRefusal({});

    expect(
      await signIn(
        native({ credential: R.failure(OAuthError.Cancelled) }).native,
      ),
    ).toEqual(R.failure(OAuthError.Cancelled));
  });

  it("returns the error the server names", async () => {
    api.throwingOnRefusal({
      "POST /auth/:provider/native": () =>
        Response.json({ error: OAuthError.NoAccount }),
    });

    expect(
      await signIn(
        native({ credential: R.success({ identityToken: "t" }) }).native,
      ),
    ).toEqual(R.failure(OAuthError.NoAccount));
  });

  it("reads a request with no response as a network failure", async () => {
    api.throwingOnRefusal({
      "POST /auth/:provider/native": () => {
        throw FetchError.createFromError(new Error("The request timed out."));
      },
    });

    expect(
      await signIn(
        native({ credential: R.success({ identityToken: "t" }) }).native,
      ),
    ).toEqual(R.failure(ClientFailure.Network));
  });

  it("reads a refused request as failed", async () => {
    api.throwingOnRefusal({
      "POST /auth/:provider/native": () =>
        Response.json({ statusCode: 429 }, { status: 429 }),
    });

    expect(
      await signIn(
        native({ credential: R.success({ identityToken: "t" }) }).native,
      ),
    ).toEqual(R.failure(OAuthError.Failed));
  });
});

describe("without a native sheet", () => {
  const browserRoutes = (redeemed: ReturnType<typeof mock>) => ({
    "POST /auth/:provider/native/browser": () =>
      Response.json({
        url: "https://appleid.apple.com/auth/authorize",
        proof: "proof",
        returnTo: MOBILE_OAUTH_RETURN_URL,
      }),
    "POST /auth/:provider/native/redeem": async ({
      request,
    }: {
      request: Request;
    }) => {
      redeemed(await request.json());
      return Response.json({ session });
    },
  });

  it("opens the server's link and redeems the handoff with the proof", async () => {
    const redeemed = mock();
    api.throwingOnRefusal(browserRoutes(redeemed));

    const device = native({
      credential: null,
      returned: R.success(returnLink("handoff=abc")),
    });
    expect(await signIn(device.native)).toEqual(R.success(session));
    expect(device.openBrowserSession).toHaveBeenCalledWith({
      url: "https://appleid.apple.com/auth/authorize",
      returnTo: MOBILE_OAUTH_RETURN_URL,
      markAuthTab: true,
    });
    expect(redeemed).toHaveBeenCalledWith({
      handoff: "abc",
      proof: "proof",
      guestToken: "guest",
    });
  });

  it("stops at a closed browser", async () => {
    const redeemed = mock();
    api.throwingOnRefusal(browserRoutes(redeemed));

    expect(await signIn(native({ credential: null }).native)).toEqual(
      R.failure(OAuthError.Cancelled),
    );
    expect(redeemed).not.toHaveBeenCalled();
  });

  it("returns the error the return link names", async () => {
    const redeemed = mock();
    api.throwingOnRefusal(browserRoutes(redeemed));

    expect(
      await signIn(
        native({
          credential: null,
          returned: R.success(returnLink("error=no_account")),
        }).native,
      ),
    ).toEqual(R.failure(OAuthError.NoAccount));
    expect(redeemed).not.toHaveBeenCalled();
  });
});
