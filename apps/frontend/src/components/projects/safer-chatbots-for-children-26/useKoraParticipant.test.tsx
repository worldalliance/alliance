import type { KoraParticipantStateDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { expect, test } from "bun:test";
import type { ReactNode } from "react";
import { AuthContext, type AuthContextType } from "../../../lib/AuthContext";
import { useSignedInParticipant } from "./useKoraParticipant";

const participant = { id: "p1", name: "Participant" };
const state: KoraParticipantStateDto = {
  participant,
  pendingCode: null,
  signupPending: false,
};

serveApi(routes({ "GET /kora/me": () => Response.json(state) }));

const member: AuthContextType = {
  isAuthenticated: false,
  user: undefined,
  isImpersonation: false,
  refreshUser: () => Promise.resolve(),
  login: () => Promise.resolve(),
  onLogin: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  loading: false,
};

const renderParticipant = (auth: Partial<AuthContextType>) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ ...member, ...auth }}>
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return { client, ...renderHook(useSignedInParticipant, { wrapper }) };
};

test("returns the participant signed in by cookie", async () => {
  const { result } = renderParticipant({});
  await waitFor(() => expect(result.current).toEqual(participant));
});

test("returns no participant to a signed-in or still-loading member", async () => {
  for (const auth of [{ isAuthenticated: true }, { loading: true }]) {
    const { result, client } = renderParticipant(auth);
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current).toBeNull();
  }
});
