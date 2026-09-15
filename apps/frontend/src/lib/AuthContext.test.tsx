import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { testAuthUser } from "../stories/testData";
import { AuthProvider, useAuth, type AuthContextType } from "./AuthContext";

let unreachable = false;
// With a zone, the time zone backfill leaves the server alone.
const member = { ...testAuthUser, timeZone: "America/New_York" };

serveApi(
  routes({
    "GET /auth/me": () => {
      if (unreachable) throw new TypeError("Failed to fetch");
      return Response.json({ user: member });
    },
  }),
);

afterEach(() => {
  cleanup();
  unreachable = false;
});

let auth: AuthContextType | undefined;

const Member = () => {
  auth = useAuth();
  return <p>{auth.user?.email}</p>;
};

it("keeps the member when a reload never reaches the server", async () => {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider queryClient={queryClient}>
        <Member />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await screen.findByText(member.email);
  unreachable = true;
  const logged = jest.spyOn(console, "log").mockImplementation(() => {});
  const reported = jest.spyOn(console, "error");

  await act(() => auth!.refreshUser());

  expect(auth?.user).toEqual(member);
  expect(logged).toHaveBeenCalled();
  expect(reported).not.toHaveBeenCalled();
});
