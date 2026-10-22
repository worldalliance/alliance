import {
  MOBILE_OAUTH_RETURN_URL,
  OAuthError,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { afterAll, describe, expect, it, mock, spyOn } from "bun:test";
import { NETWORK_FAILURE_MESSAGE } from "./network";
import {
  interruptedLinkFeedback,
  linkFeedback,
  linkWithProvider,
} from "./oauthLink";
import { AuthTabFlow, ClientFailure, UNFINISHED } from "./oauthResult";
import type { NativeCredential, NativeSignIn } from "./oauthSignIn";

const consoleError = spyOn(console, "error").mockImplementation(() => {});

afterAll(() => {
  consoleError.mockRestore();
});

const api = serveApi(routes({}));

const user = makeUser({
  id: 7,
  oauthAccounts: [{ provider: OAuthProvider.Google, email: "g@example.com" }],
});

function native(params: {
  credential: Result<NativeCredential, OAuthError> | null;
  returned?: Result<string, OAuthError>;
}) {
  const credential = async () => params.credential;
  return {
    credential: {
      [OAuthProvider.Google]: credential,
      [OAuthProvider.Apple]: credential,
    },
    openBrowserSession: mock<NativeSignIn["openBrowserSession"]>(
      async () => params.returned ?? R.failure(OAuthError.Cancelled),
    ),
  };
}

const link = (device: NativeSignIn) =>
  linkWithProvider({
    provider: OAuthProvider.Google,
    userId: 7,
    native: device,
  });

describe("with a native sheet", () => {
  it("sends the identity token for the member it started for", async () => {
    const sent = mock();
    api.throwingOnRefusal({
      "POST /auth/:provider/link/native": async ({ request, params }) => {
        sent({ provider: params.provider, body: await request.json() });
        return Response.json({ user });
      },
    });

    expect(
      await link(native({ credential: R.success({ identityToken: "t" }) })),
    ).toEqual(R.success(user));
    expect(sent).toHaveBeenCalledWith({
      provider: OAuthProvider.Google,
      body: { identityToken: "t", userId: 7 },
    });
  });

  it("returns the refusal the server names", async () => {
    api.throwingOnRefusal({
      "POST /auth/:provider/link/native": () =>
        Response.json({ error: OAuthError.ClaimedByAnotherAccount }),
    });

    expect(
      await link(native({ credential: R.success({ identityToken: "t" }) })),
    ).toEqual(R.failure(OAuthError.ClaimedByAnotherAccount));
  });

  it("reads an answer with no user or known error as failed", async () => {
    api.throwingOnRefusal({
      "POST /auth/:provider/link/native": () =>
        Response.json({ error: "nonsense" }),
    });

    expect(
      await link(native({ credential: R.success({ identityToken: "t" }) })),
    ).toEqual(R.failure(OAuthError.Failed));
  });

  it("stops at a cancelled sheet without asking the server", async () => {
    api.throwingOnRefusal({});

    expect(
      await link(native({ credential: R.failure(OAuthError.Cancelled) })),
    ).toEqual(R.failure(OAuthError.Cancelled));
  });
});

describe("without a native sheet", () => {
  it("opens the link session unmarked and redeems the handoff with its proof", async () => {
    const redeemed = mock();
    api.throwingOnRefusal({
      "POST /auth/:provider/link/browser": () =>
        Response.json({
          url: "https://accounts.google.com/o/oauth2/v2/auth",
          proof: "proof",
          returnTo: MOBILE_OAUTH_RETURN_URL,
        }),
      "POST /auth/:provider/link/redeem": async ({ request }) => {
        redeemed(await request.json());
        return Response.json({ user });
      },
    });

    const device = native({
      credential: null,
      returned: R.success(`${MOBILE_OAUTH_RETURN_URL}?handoff=abc`),
    });
    expect(await link(device)).toEqual(R.success(user));
    expect(device.openBrowserSession).toHaveBeenCalledWith({
      url: "https://accounts.google.com/o/oauth2/v2/auth",
      returnTo: MOBILE_OAUTH_RETURN_URL,
      authTabFlow: AuthTabFlow.Link,
    });
    expect(redeemed).toHaveBeenCalledWith({ handoff: "abc", proof: "proof" });
  });
});

describe("linkFeedback", () => {
  const feedback = (result: Parameters<typeof linkFeedback>[0]["result"]) =>
    linkFeedback({ provider: OAuthProvider.Apple, result });

  it("says nothing for a cancellation", () => {
    expect(feedback(R.failure(OAuthError.Cancelled))).toBeNull();
  });

  it("names the provider on success and on a refusal", () => {
    expect(feedback(R.success(user))).toEqual({
      ok: true,
      message: "Your Apple account is now linked.",
    });
    expect(feedback(R.failure(OAuthError.ProviderAlreadyConnected))).toEqual({
      ok: false,
      message:
        "A different Apple account is already connected to your Alliance account. Disconnect that one first.",
    });
  });

  it("says a lost connection is one", () => {
    expect(feedback(R.failure(ClientFailure.Network))).toEqual({
      ok: false,
      message: NETWORK_FAILURE_MESSAGE,
    });
  });
});

describe("interruptedLinkFeedback", () => {
  it("says a cut-off connect didn't finish", () => {
    expect(interruptedLinkFeedback(UNFINISHED)).toEqual({
      ok: false,
      message: "Connecting that account didn't finish. Please try again.",
    });
  });

  it("names both providers in a refusal, since the flow that knew which died", () => {
    expect(interruptedLinkFeedback(OAuthError.ClaimedByAnotherAccount)).toEqual(
      {
        ok: false,
        message:
          "That Google or Apple account is already linked to a different Alliance account.",
      },
    );
  });

  it("says nothing for a cancellation", () => {
    expect(interruptedLinkFeedback(OAuthError.Cancelled)).toBeNull();
  });
});
