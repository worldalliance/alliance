import type { UserDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextType } from "../../lib/AuthContext";
import { testAuthUser } from "../../stories/testData";
import SettingsPage from "./SettingsPage";

const me: UserDto = { ...testAuthUser, phoneNumber: null };
let seedings = 0;

serveApi(
  routes({
    "GET /auth/me": () => {
      seedings += 1;
      return Response.json({ user: me });
    },
    "GET /user/mylocation": () => Response.json({ city: null }),
  }),
);

afterEach(() => {
  cleanup();
  seedings = 0;
});

const noop = () => Promise.resolve();

const settings = (user: UserDto) => {
  const auth: AuthContextType = {
    isAuthenticated: true,
    user,
    isImpersonation: false,
    refreshUser: noop,
    login: noop,
    onLogin: noop,
    logout: noop,
    loading: false,
  };
  return (
    <MemoryRouter initialEntries={["/settings"]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={auth}>
          <SettingsPage />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

it("keeps what the member typed when the auth user is refreshed", async () => {
  const { rerender } = render(settings(me));

  const phoneNumber = await screen.findByPlaceholderText("Enter phone number");
  fireEvent.focus(phoneNumber);
  fireEvent.change(phoneNumber, { target: { value: "415555" } });
  // A half-typed number is never sent, so the form is all that holds it.
  fireEvent.blur(phoneNumber);
  const typed = (phoneNumber as HTMLInputElement).value;
  expect(typed).toContain("415");

  rerender(settings({ ...me }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(
    (screen.getByPlaceholderText("Enter phone number") as HTMLInputElement)
      .value,
  ).toBe(typed);
  expect(seedings).toBe(1);
});
