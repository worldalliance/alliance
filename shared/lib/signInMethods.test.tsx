import { OAuthProvider } from "@alliance/common/oauth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { UserDto } from "../client";
import {
  canDisconnect,
  signInMethods,
  useSignInMethods,
} from "./signInMethods";
import { makeUser } from "./testFixtures";
import { routes, serveApi } from "./testing/serveApi";

const google = { provider: OAuthProvider.Google, email: "g@example.com" };
const apple = { provider: OAuthProvider.Apple, email: "a@privaterelay.com" };

describe("canDisconnect", () => {
  it("allows any provider while a password remains", () => {
    const methods = signInMethods(makeUser({ oauthAccounts: [google] }));

    expect(canDisconnect(methods, OAuthProvider.Google)).toBe(true);
  });

  it("refuses the only way in", () => {
    const methods = signInMethods(
      makeUser({ hasPassword: false, oauthAccounts: [google] }),
    );

    expect(canDisconnect(methods, OAuthProvider.Google)).toBe(false);
  });

  it("allows either of two providers without a password", () => {
    const methods = signInMethods(
      makeUser({ hasPassword: false, oauthAccounts: [google, apple] }),
    );

    expect(canDisconnect(methods, OAuthProvider.Google)).toBe(true);
    expect(canDisconnect(methods, OAuthProvider.Apple)).toBe(true);
  });
});

let me: UserDto;
let meFails = false;
let meLoads = 0;
let meGate: Promise<void>;
let unlink: () => Response;

serveApi(
  routes({
    "GET /auth/me": async () => {
      meLoads += 1;
      await meGate;
      return meFails
        ? Response.json({ message: "down" }, { status: 500 })
        : Response.json({ user: me });
    },
    "DELETE /auth/:provider/link": () => unlink(),
  }),
);

beforeEach(() => {
  me = makeUser({ oauthAccounts: [google] });
  meFails = false;
  meLoads = 0;
  meGate = Promise.resolve();
});

const holdMe = () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  meGate = promise;
  return resolve;
};

const render = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSignInMethods(), { wrapper });
};

describe("useSignInMethods", () => {
  it("shows no connections when the load fails", async () => {
    meFails = true;
    const { result } = render();

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.methods).toBeNull();
  });

  it("drops what it showed when a reload fails", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.methods).not.toBeNull());
    meFails = true;

    act(() => {
      void result.current.reload();
    });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.methods).toBeNull();
  });

  it("fails the load when the user carries no connections field", async () => {
    me = makeUser({ oauthAccounts: undefined });
    const { result } = render();

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.methods).toBeNull();
  });

  it("reloads from the server after a disconnect before settling", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.methods).not.toBeNull());
    unlink = () => {
      me = makeUser({ oauthAccounts: [] });
      return Response.json({ user: me });
    };

    act(() => result.current.disconnect(OAuthProvider.Google));

    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.methods?.accounts.google).toBeNull();
    expect(meLoads).toBe(2);
  });

  it("reports the server's refusal and reloads what it has", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.methods).not.toBeNull());
    unlink = () =>
      Response.json(
        { message: "Google is the only way into your account." },
        { status: 400 },
      );

    act(() => result.current.disconnect(OAuthProvider.Google));

    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.disconnectError).toBe(
      "Google is the only way into your account.",
    );
    expect(result.current.methods?.accounts.google).toEqual(google);
    expect(meLoads).toBe(2);
  });

  it("keeps reload the same function across renders", async () => {
    const { result, rerender } = render();
    await waitFor(() => expect(result.current.methods).not.toBeNull());
    const { reload } = result.current;

    rerender();

    expect(result.current.reload).toBe(reload);
  });

  it("stays busy until the reload after a disconnect lands", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.methods).not.toBeNull());
    unlink = () => Response.json({ user: makeUser({ oauthAccounts: [] }) });
    const release = holdMe();

    act(() => result.current.disconnect(OAuthProvider.Google));

    await waitFor(() => expect(meLoads).toBe(2));
    expect(result.current.busy).toBe(true);
    release();
    await waitFor(() => expect(result.current.busy).toBe(false));
  });

  it("stays busy until the reload after a link lands", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.methods).not.toBeNull());
    const release = holdMe();

    act(() => {
      void result.current.settle(makeUser({ oauthAccounts: [google, apple] }));
    });

    await waitFor(() => expect(meLoads).toBe(2));
    expect(result.current.busy).toBe(true);
    expect(result.current.methods?.accounts.apple).toEqual(apple);
    release();
    await waitFor(() => expect(result.current.busy).toBe(false));
  });

  it.each([
    [500, "Couldn't disconnect. Please try again."],
    [401, "Your session has expired. Sign in again."],
  ])("explains a %i disconnect in words", async (status, message) => {
    const { result } = render();
    await waitFor(() => expect(result.current.methods).not.toBeNull());
    unlink = () =>
      Response.json(
        { statusCode: status, message: "framework text" },
        { status },
      );

    act(() => result.current.disconnect(OAuthProvider.Google));

    await waitFor(() => expect(result.current.disconnectError).toBe(message));
  });

  it("says to try again when the connection drops", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.methods).not.toBeNull());
    unlink = () => {
      throw new TypeError("Failed to fetch");
    };

    act(() => result.current.disconnect(OAuthProvider.Google));

    await waitFor(() =>
      expect(result.current.disconnectError).toBe(
        "Couldn't disconnect. Please try again.",
      ),
    );
  });
});
