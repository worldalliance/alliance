import { R } from "@alliance/common/result";
import {
  REVIEW_ACCOUNT_MESSAGE,
  REVIEW_SIGN_IN_UNAVAILABLE_MESSAGE,
} from "@alliance/common/review-account";
import {
  routes,
  serveApi,
  SERVED_API_URL,
} from "@alliance/shared/lib/testing/serveApi";
import { afterEach, expect, it, mock } from "bun:test";
import { STAGING } from "./releaseTarget";
import { requestSession } from "./reviewSignIn";
import { ReviewSignInUnavailableError } from "./reviewSignInErrors";
import { CredentialsRefusedError, passwordLoginFailure } from "./session";

const api = serveApi(routes({}));

const credentials = {
  email: "reviewer@example.com",
  password: "hunter2",
  guestToken: "guest",
};
const clearGuestToken = mock(async () => {});

afterEach(() => clearGuestToken.mockClear());

const requestWith = () =>
  requestSession({
    credentials,
    binaryApiUrl: SERVED_API_URL,
    clearGuestToken,
  });

const tokens = { access_token: "access", refresh_token: "refresh" };
const stagingLogin = `POST ${new URL(STAGING.apiUrl).pathname}/auth/login`;

const refusedAsReviewAccount = () =>
  Response.json(
    { statusCode: 403, message: REVIEW_ACCOUNT_MESSAGE },
    { status: 403 },
  );

it("keeps an ordinary account on the binary's deployment", async () => {
  const staging = mock(() => Response.json(tokens));
  api.throwingOnRefusal({
    "POST /auth/login": () => Response.json({ isAdmin: false, ...tokens }),
    [stagingLogin]: staging,
  });

  const requested = await requestWith();

  expect(requested).toEqual(R.success({ tokens, review: false }));
  expect(staging).not.toHaveBeenCalled();
  expect(clearGuestToken).toHaveBeenCalledTimes(1);
});

it("signs a review account in on staging, without the guest token", async () => {
  const sent = mock();
  api.throwingOnRefusal({
    "POST /auth/login": refusedAsReviewAccount,
    [stagingLogin]: async ({ request }) => {
      sent(new URL(request.url).origin, await request.json());
      return Response.json({ isAdmin: false, ...tokens });
    },
  });

  const requested = await requestWith();

  expect(requested).toEqual(R.success({ tokens, review: true }));
  expect(sent).toHaveBeenCalledWith(new URL(STAGING.apiUrl).origin, {
    email: credentials.email,
    password: credentials.password,
    mode: "header",
  });
  expect(clearGuestToken).not.toHaveBeenCalled();
});

it.each([
  ["refuses the credentials", () => new Response(null, { status: 401 }), true],
  ["fails", () => new Response(null, { status: 502 }), true],
  [
    "can't be reached",
    () => Promise.reject(new Error("fetch failed: offline")),
    false,
  ],
])(
  "tells the reviewer sign-in is unavailable when staging %s",
  async (_name, answer, report) => {
    api.throwingOnRefusal({
      "POST /auth/login": refusedAsReviewAccount,
      [stagingLogin]: answer,
    });

    const requested = await requestWith();

    const error = requested.ok ? undefined : requested.error;
    expect(error).toBeInstanceOf(ReviewSignInUnavailableError);
    expect(passwordLoginFailure(error)).toEqual({
      message: REVIEW_SIGN_IN_UNAVAILABLE_MESSAGE,
      report,
    });
  },
);

it("reports a refusal that isn't a review account's as it is", async () => {
  api.throwingOnRefusal({
    "POST /auth/login": () =>
      Response.json({ message: "Unauthorized" }, { status: 401 }),
  });

  const requested = await requestWith();

  expect(requested.ok ? undefined : requested.error).toBeInstanceOf(
    CredentialsRefusedError,
  );
  expect(clearGuestToken).not.toHaveBeenCalled();
});
