import { NodeEnv } from "@alliance/common/node-env";
import {
  OAuthError,
  OAuthOutcome,
  OAuthProvider,
} from "@alliance/common/oauth";
import { BadRequestException } from "@nestjs/common";
import {
  oauthRedirectUri,
  resolveReturnTo,
  returnUrlWithError,
  returnUrlWithOutcome,
} from "./oauth-urls";

const DEPLOYED_ENV = {
  NODE_ENV: NodeEnv.Production,
  APP_URL: "https://worldalliance.org",
  ALT_APP_URL: "https://thealliance.org",
  ADMIN_URL: "https://admin.worldalliance.org",
  ALT_ADMIN_URL: "https://admin.thealliance.org",
};

const asRequest = (origin: string) => {
  const url = new URL(origin);
  return {
    protocol: url.protocol.replace(":", ""),
    get: () => url.host,
  };
};

const withEnv = (env: Record<string, string>, run: () => void): void => {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    run();
  } finally {
    process.env = previous;
  }
};

describe("resolveReturnTo", () => {
  it.each([
    "https://worldalliance.org/login",
    "https://thealliance.org/signup?ref=abc",
    "https://www.worldalliance.org/login",
    "https://www.thealliance.org/login",
    "https://admin.worldalliance.org/",
  ])("allows %s", (returnTo) => {
    withEnv(DEPLOYED_ENV, () => {
      expect(resolveReturnTo(returnTo).toString()).toBe(returnTo);
    });
  });

  it.each([
    "https://evil.example.com/x",
    "https://worldalliance.org.evil.example.com/x",
    "http://worldalliance.org/login",
    "https://www.admin.worldalliance.org/",
  ])("rejects %s", (returnTo) => {
    withEnv(DEPLOYED_ENV, () => {
      expect(() => resolveReturnTo(returnTo)).toThrow(BadRequestException);
    });
  });

  it("rejects a relative returnTo", () => {
    withEnv(DEPLOYED_ENV, () => {
      expect(() => resolveReturnTo("/login")).toThrow(BadRequestException);
    });
  });

  it("allows localhost outside a deployed environment", () => {
    withEnv({ ...DEPLOYED_ENV, NODE_ENV: NodeEnv.Development }, () => {
      expect(resolveReturnTo("http://localhost:5173/login").toString()).toBe(
        "http://localhost:5173/login",
      );
    });
  });
});

describe("a scheme that is not the web's", () => {
  it.each(["alliance://auth/evil", "alliance://elsewhere"])(
    "refuses %s",
    (returnTo) => {
      withEnv(DEPLOYED_ENV, () => {
        expect(() => resolveReturnTo(returnTo)).toThrow(BadRequestException);
      });
    },
  );
});

describe("oauthRedirectUri", () => {
  it("stays on the origin the member came from, under the /api prefix", () => {
    withEnv(DEPLOYED_ENV, () => {
      expect(
        oauthRedirectUri({
          req: asRequest("https://worldalliance.org"),
          provider: OAuthProvider.Apple,
          returnTo: new URL("https://www.thealliance.org/login"),
        }),
      ).toBe("https://www.thealliance.org/api/auth/apple/callback");
    });
  });

  it("hits the api directly and drops the prefix in development", () => {
    withEnv({ ...DEPLOYED_ENV, NODE_ENV: NodeEnv.Development }, () => {
      expect(
        oauthRedirectUri({
          req: asRequest("http://localhost:3005"),
          provider: OAuthProvider.Google,
          returnTo: new URL("http://localhost:5173/login"),
        }),
      ).toBe("http://localhost:3005/auth/google/callback");
    });
  });
});

describe("returnUrl", () => {
  it("keeps the query the caller already had", () => {
    expect(
      returnUrlWithOutcome({
        returnTo: "https://worldalliance.org/signup?ref=abc",
        provider: OAuthProvider.Google,
        outcome: OAuthOutcome.SignedUp,
      }),
    ).toBe("https://worldalliance.org/signup?ref=abc&google=signed_up");
  });

  it("names the error after the provider", () => {
    expect(
      returnUrlWithError({
        returnTo: "https://worldalliance.org/login",
        provider: OAuthProvider.Apple,
        error: OAuthError.NoAccount,
      }),
    ).toBe("https://worldalliance.org/login?appleError=no_account");
  });
});
