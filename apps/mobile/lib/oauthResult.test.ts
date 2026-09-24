import { ExceptionEvent } from "@alliance/common/analytics";
import {
  MOBILE_OAUTH_RETURN_PATH,
  MOBILE_OAUTH_RETURN_URL,
  OAuthError,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import {
  __resetAnalyticsForTests,
  registerAnalytics,
} from "@alliance/shared/lib/analytics";
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { WebBrowserResultType } from "expo-web-browser/build/WebBrowser.types";
import { FetchError } from "expo/src/winter/fetch/FetchErrors";
import { AuthTabResultType } from "../modules/auth-tab/src/AuthTab.types";
import {
  AuthTabFlow,
  ClientFailure,
  FailureTone,
  handoffFromReturnLink,
  interruptedFailure,
  isOAuthReturnLink,
  oauthReturnRedirect,
  providerFailureFor,
  reportOAuthFailure,
  requestFailure,
  returnLinkFromAuthTab,
  returnLinkFromBrowser,
  sessionResult,
  takeInterruptedAuthTab,
  thrownFailure,
  UNFINISHED_FAILURE,
  whileAuthTabOpen,
  type OAuthFailure,
} from "./oauthResult";

const consoleError = spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  consoleError.mockClear();
});

describe("reportOAuthFailure", () => {
  afterEach(() => {
    __resetAnalyticsForTests();
  });

  const reported = () => {
    __resetAnalyticsForTests();
    const captured: { error: unknown; properties: unknown }[] = [];
    registerAnalytics({
      capture: () => {},
      captureException: (error, properties) => {
        captured.push({ error, properties });
      },
    });
    return captured;
  };

  it("reports the failure with its cause", () => {
    const captured = reported();
    const cause = new Error("DEVELOPER_ERROR");
    reportOAuthFailure("google sign-in failed", cause);

    expect(consoleError).toHaveBeenCalledWith("google sign-in failed", cause);
    expect(captured).toHaveLength(1);
    expect(captured[0].error).toBeInstanceOf(Error);
    expect(captured[0].error).toMatchObject({
      message: "google sign-in failed",
      cause,
    });
    expect(captured[0].properties).toMatchObject({
      event: ExceptionEvent.OAuthFailed,
    });
  });

  it("reports what a refused request answered", () => {
    const captured = reported();
    requestFailure({ statusCode: 429, message: "Too Many Requests" });

    expect(captured[0].properties).toMatchObject({
      properties: {
        details: ['{"statusCode":429,"message":"Too Many Requests"}'],
      },
    });
  });

  it("keeps a return link that doesn't parse out of the report", () => {
    const captured = reported();
    handoffFromReturnLink("alliance://[?handoff=secret");

    expect(captured).toHaveLength(1);
    expect(JSON.stringify(captured[0].properties)).not.toContain("secret");
    expect(captured[0].error).toMatchObject({ cause: undefined });
  });
});

describe("requestFailure", () => {
  it("reads expo/fetch's no-response errors as a network failure", () => {
    for (const reason of [
      "The Internet connection appears to be offline.",
      "The request timed out.",
      'Unable to resolve host "worldalliance.org"',
    ]) {
      expect(
        requestFailure(FetchError.createFromError(new Error(reason))),
      ).toBe(ClientFailure.Network);
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs any other error as failed", () => {
    expect(requestFailure(new TypeError("undefined is not a function"))).toBe(
      OAuthError.Failed,
    );
    expect(requestFailure({ statusCode: 500 })).toBe(OAuthError.Failed);
    expect(consoleError).toHaveBeenCalledTimes(2);
  });
});

describe("thrownFailure", () => {
  it("reads a profile load with no response as a network failure", () => {
    const cause = FetchError.createFromError(
      new Error("The Internet connection appears to be offline."),
    );
    expect(
      thrownFailure(new Error("Failed to fetch user profile", { cause })),
    ).toBe(ClientFailure.Network);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs any other throw as failed", () => {
    expect(thrownFailure(new Error("Failed to fetch user profile"))).toBe(
      OAuthError.Failed,
    );
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe("sessionResult", () => {
  const session = { access_token: "a", refresh_token: "r" };

  it("returns the session", () => {
    expect(sessionResult({ session })).toEqual(R.success(session));
  });

  it("returns the error the server names", () => {
    expect(sessionResult({ error: OAuthError.NoAccount })).toEqual(
      R.failure(OAuthError.NoAccount),
    );
  });

  it("fails on an empty or unknown body", () => {
    expect(sessionResult(undefined)).toEqual(R.failure(OAuthError.Failed));
    expect(sessionResult({})).toEqual(R.failure(OAuthError.Failed));
    expect(consoleError).toHaveBeenCalledTimes(2);
  });
});

describe("handoffFromReturnLink", () => {
  it("reads the handoff from either link", () => {
    expect(
      handoffFromReturnLink(`${MOBILE_OAUTH_RETURN_URL}?handoff=abc`),
    ).toEqual(R.success("abc"));
    expect(
      handoffFromReturnLink(
        `https://worldalliance.org${MOBILE_OAUTH_RETURN_PATH}?handoff=abc`,
      ),
    ).toEqual(R.success("abc"));
  });

  it("returns the error the server names", () => {
    expect(
      handoffFromReturnLink(`${MOBILE_OAUTH_RETURN_URL}?error=expired`),
    ).toEqual(R.failure(OAuthError.Expired));
  });

  it("fails when the link carries neither", () => {
    expect(handoffFromReturnLink(MOBILE_OAUTH_RETURN_URL)).toEqual(
      R.failure(OAuthError.Failed),
    );
    expect(
      handoffFromReturnLink(`${MOBILE_OAUTH_RETURN_URL}?error=bogus`),
    ).toEqual(R.failure(OAuthError.Failed));
    expect(
      handoffFromReturnLink(`${MOBILE_OAUTH_RETURN_URL}?handoff=`),
    ).toEqual(R.failure(OAuthError.Failed));
    expect(consoleError).toHaveBeenCalledTimes(3);
    expect(consoleError).toHaveBeenCalledWith(
      "oauth return link carried no handoff or known error",
    );
  });

  it("fails on a link that doesn't parse, and keeps it out of the log", () => {
    expect(handoffFromReturnLink("alliance://[?handoff=abc")).toEqual(
      R.failure(OAuthError.Failed),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "oauth return link did not parse",
    );
  });
});

describe("returnLinkFromAuthTab", () => {
  const url = `${MOBILE_OAUTH_RETURN_URL}?handoff=abc`;

  it("returns the link the tab closed on", () => {
    expect(
      returnLinkFromAuthTab({
        type: AuthTabResultType.Success,
        resultCode: -1,
        url,
      }),
    ).toEqual(R.success(url));
  });

  it("reads closing the tab as a cancellation", () => {
    expect(
      returnLinkFromAuthTab({
        type: AuthTabResultType.Cancel,
        resultCode: 0,
        url: null,
      }),
    ).toEqual(R.failure(OAuthError.Cancelled));
  });

  it("logs a failed link verification as failed", () => {
    for (const [type, resultCode] of [
      [AuthTabResultType.VerificationFailed, 2],
      [AuthTabResultType.VerificationTimedOut, 3],
      [AuthTabResultType.Unknown, 42],
    ] as const) {
      expect(returnLinkFromAuthTab({ type, resultCode, url: null })).toEqual(
        R.failure(OAuthError.Failed),
      );
    }
    expect(
      returnLinkFromAuthTab({
        type: AuthTabResultType.Success,
        resultCode: -1,
        url: null,
      }),
    ).toEqual(R.failure(OAuthError.Failed));
    expect(consoleError).toHaveBeenCalledTimes(4);
    expect(consoleError).toHaveBeenCalledWith(
      "auth tab failed",
      AuthTabResultType.Unknown,
      42,
    );
    expect(consoleError).toHaveBeenCalledWith("auth tab succeeded with no url");
  });
});

describe("returnLinkFromBrowser", () => {
  it("returns the link the browser closed on", () => {
    const url = `${MOBILE_OAUTH_RETURN_URL}?handoff=abc`;
    expect(returnLinkFromBrowser({ type: "success", url })).toEqual(
      R.success(url),
    );
  });

  it("reads closing the browser as a cancellation", () => {
    for (const type of [
      WebBrowserResultType.CANCEL,
      WebBrowserResultType.DISMISS,
    ]) {
      expect(returnLinkFromBrowser({ type })).toEqual(
        R.failure(OAuthError.Cancelled),
      );
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs a browser that never waited on the link as failed", () => {
    for (const type of [
      WebBrowserResultType.OPENED,
      WebBrowserResultType.LOCKED,
    ]) {
      expect(returnLinkFromBrowser({ type })).toEqual(
        R.failure(OAuthError.Failed),
      );
    }
    expect(consoleError).toHaveBeenCalledTimes(2);
  });
});

describe("isOAuthReturnLink", () => {
  it("matches the scheme and the https path", () => {
    expect(isOAuthReturnLink(`${MOBILE_OAUTH_RETURN_URL}?handoff=abc`)).toBe(
      true,
    );
    expect(isOAuthReturnLink(MOBILE_OAUTH_RETURN_URL)).toBe(true);
    expect(isOAuthReturnLink(`${MOBILE_OAUTH_RETURN_URL}/?error=failed`)).toBe(
      true,
    );
    expect(
      isOAuthReturnLink(
        `https://worldalliance.org${MOBILE_OAUTH_RETURN_PATH}?handoff=abc`,
      ),
    ).toBe(true);
  });

  it("leaves every other link to the router", () => {
    expect(isOAuthReturnLink("https://worldalliance.org/actions/12")).toBe(
      false,
    );
    expect(isOAuthReturnLink("alliance://actions/12")).toBe(false);
    expect(isOAuthReturnLink("/actions/12")).toBe(false);
    expect(isOAuthReturnLink(`${MOBILE_OAUTH_RETURN_URL}evil`)).toBe(false);
  });

  it("leaves the root link every launch opens on to the router", () => {
    expect(isOAuthReturnLink("alliance:///")).toBe(false);
    expect(isOAuthReturnLink("alliance://")).toBe(false);
  });

  it("leaves the path on another host to the router", () => {
    expect(
      isOAuthReturnLink(`https://evil.example${MOBILE_OAUTH_RETURN_PATH}`),
    ).toBe(false);
    expect(
      isOAuthReturnLink(`alliance://evil.example${MOBILE_OAUTH_RETURN_PATH}`),
    ).toBe(false);
    expect(isOAuthReturnLink(MOBILE_OAUTH_RETURN_PATH)).toBe(false);
  });

  it("leaves a link that doesn't parse to the router", () => {
    expect(isOAuthReturnLink("alliance://host:99999/x")).toBe(false);
    expect(isOAuthReturnLink("alliance://[")).toBe(false);
    expect(isOAuthReturnLink("//")).toBe(false);
  });
});

describe("oauthReturnRedirect", () => {
  const link = `${MOBILE_OAUTH_RETURN_URL}?handoff=abc`;

  it("keeps a return link out of the router while a sign-in waits on it", () => {
    expect(oauthReturnRedirect({ path: link, initial: false })).toBeNull();
  });

  it("sends a return link that opened the app to the gate", () => {
    expect(oauthReturnRedirect({ path: link, initial: true })).toBe(
      "/onboarding?oauthInterrupted=unfinished",
    );
  });

  it("passes on the error a return link that opened the app names", () => {
    expect(
      oauthReturnRedirect({
        path: `${MOBILE_OAUTH_RETURN_URL}?error=no_account`,
        initial: true,
      }),
    ).toBe("/onboarding?oauthInterrupted=no_account");
  });

  it("leaves every other link to the router, cold start or not", () => {
    for (const initial of [true, false]) {
      expect(
        oauthReturnRedirect({ path: "alliance://actions/12", initial }),
      ).toBe("alliance://actions/12");
    }
  });
});

describe("interruptedFailure", () => {
  it("asks for a retry when the link carried a handoff", () => {
    expect(interruptedFailure("unfinished")).toEqual(UNFINISHED_FAILURE);
    expect(UNFINISHED_FAILURE).toEqual({
      tone: FailureTone.Error,
      message: "That sign-in didn't finish. Please try again.",
    });
  });

  it("shows the error the link named, for either provider", () => {
    expect(interruptedFailure(OAuthError.NoAccount)).toEqual(
      providerFailureFor({ provider: null, failure: OAuthError.NoAccount }),
    );
    expect(interruptedFailure(OAuthError.Cancelled).tone).toBe(
      FailureTone.Notice,
    );
    expect(interruptedFailure(OAuthError.Expired).message).toBe(
      "That took too long. Please try again.",
    );
  });
});

describe("the Auth Tab marker", () => {
  const memoryStorage = () => {
    const items = new Map<string, string>();
    return {
      items,
      getItem: async (key: string) => items.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        items.set(key, value);
      },
      removeItem: async (key: string) => {
        items.delete(key);
      },
    };
  };

  const signIn = AuthTabFlow.SignIn;

  it("reports a tab a killed launch left open, once", async () => {
    const storage = memoryStorage();
    storage.items.set("oauthAuthTabOpen", "an earlier launch");

    expect(await takeInterruptedAuthTab(storage, signIn)).toBe(true);
    expect(await takeInterruptedAuthTab(storage, signIn)).toBe(false);
  });

  it("keeps a link's tab apart from a sign-in's", async () => {
    const storage = memoryStorage();
    storage.items.set("oauthLinkAuthTabOpen", "an earlier launch");

    expect(await takeInterruptedAuthTab(storage, signIn)).toBe(false);
    expect(await takeInterruptedAuthTab(storage, AuthTabFlow.Link)).toBe(true);
  });

  it("ignores the tab this launch has open", async () => {
    const storage = memoryStorage();
    await whileAuthTabOpen({
      storage,
      flow: signIn,
      open: async () => {
        expect(await takeInterruptedAuthTab(storage, signIn)).toBe(false);
      },
    });
  });

  it("clears the marker once the tab returns, even when opening it throws", async () => {
    const storage = memoryStorage();
    expect(
      await whileAuthTabOpen({
        storage,
        flow: signIn,
        open: async () => "returned",
      }),
    ).toBe("returned");
    await expect(
      whileAuthTabOpen({
        storage,
        flow: signIn,
        open: async () => {
          throw new Error("already open");
        },
      }),
    ).rejects.toThrow("already open");
    expect(storage.items.size).toBe(0);
  });

  it("still opens the tab when storage fails, and logs it", async () => {
    const storage = {
      getItem: async () => {
        throw new Error("disk");
      },
      setItem: async () => {
        throw new Error("disk");
      },
      removeItem: async () => {
        throw new Error("disk");
      },
    };
    expect(
      await whileAuthTabOpen({
        storage,
        flow: signIn,
        open: async () => "returned",
      }),
    ).toBe("returned");
    expect(await takeInterruptedAuthTab(storage, signIn)).toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(3);
  });
});

describe("providerFailureFor", () => {
  const message = (provider: OAuthProvider, failure: OAuthFailure) =>
    providerFailureFor({ provider, failure }).message;

  it("shows only a cancellation as a notice", () => {
    const failures: OAuthFailure[] = [
      ...Object.values(OAuthError),
      ...Object.values(ClientFailure),
    ];
    expect(
      failures.filter(
        (failure) =>
          providerFailureFor({ provider: null, failure }).tone ===
          FailureTone.Notice,
      ),
    ).toEqual([OAuthError.Cancelled]);
  });

  it("offers the other ways in when there is no account", () => {
    const noAccount = message(OAuthProvider.Apple, OAuthError.NoAccount);
    expect(noAccount).toContain("Google or Apple");
    expect(noAccount).toContain("email and password");
    expect(noAccount).not.toContain("invite");
  });

  it("doesn't point at a disconnect control", () => {
    expect(
      message(OAuthProvider.Google, OAuthError.ProviderAlreadyConnected),
    ).not.toContain("Disconnect");
  });

  it("names the network", () => {
    expect(message(OAuthProvider.Google, ClientFailure.Network)).toContain(
      "connection",
    );
  });
});
