import type { UserDto } from "@alliance/shared/client";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { useMe } from "@alliance/shared/lib/useMe";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./AuthContext";

let signedIn: UserDto | null;
let impersonating: boolean;
let refreshes: number;
let meGate: Promise<void>;

serveApi(
  routes({
    "GET /auth/me": async () => {
      await meGate;
      return signedIn
        ? Response.json({ user: signedIn, isImpersonation: impersonating })
        : Response.json({ message: "Unauthorized" }, { status: 401 });
    },
    "POST /auth/refresh": () => {
      refreshes += 1;
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    },
  }),
);

beforeEach(() => {
  signedIn = makeUser({ timeZone: "Europe/London" });
  impersonating = false;
  refreshes = 0;
  meGate = Promise.resolve();
});

const render = () => {
  const { wrapper: withQueries } = queryWrapper();
  const wrapper = ({ children }: { children: ReactNode }) =>
    withQueries({ children: <AuthProvider>{children}</AuthProvider> });
  return renderHook(() => ({ auth: useAuth(), me: useMe() }), { wrapper });
};

const launched = async () => {
  const view = render();
  await waitFor(() => expect(view.result.current.auth.loading).toBe(false));
  return view;
};

it("signs in the member the server has a session for", async () => {
  impersonating = true;
  const { result } = await launched();

  expect(result.current.auth.user).toEqual(signedIn);
  expect(result.current.auth.isImpersonation).toBe(true);
});

it("tries a token refresh before treating the visitor as signed out", async () => {
  signedIn = null;
  const { result } = await launched();

  expect(refreshes).toBe(1);
  expect(result.current.auth.isAuthenticated).toBe(false);
});

it("shows the member refreshUser loads", async () => {
  const { result } = await launched();
  signedIn = { ...signedIn!, name: "Renamed" };

  await act(() => result.current.auth.refreshUser());

  await waitFor(() => expect(result.current.auth.user?.name).toBe("Renamed"));
});

it("shows a member another cache write stores", async () => {
  const { result } = await launched();

  act(() => result.current.me.set({ ...signedIn!, name: "Renamed" }));

  await waitFor(() => expect(result.current.auth.user?.name).toBe("Renamed"));
});

it("swaps in the member a new session belongs to", async () => {
  const { result } = await launched();
  const next = makeUser({ id: signedIn!.id + 1, timeZone: "Europe/London" });
  signedIn = next;

  await act(() => result.current.auth.onLogin());

  await waitFor(() => expect(result.current.auth.user).toEqual(next));
});

it("keeps the member signed in while a new session loads", async () => {
  const { result } = await launched();
  const held = Promise.withResolvers<void>();
  meGate = held.promise;

  let started!: Promise<void>;
  act(() => {
    started = result.current.auth.onLogin();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  expect(result.current.auth.isAuthenticated).toBe(true);
  held.resolve();
  await act(() => started);
});
