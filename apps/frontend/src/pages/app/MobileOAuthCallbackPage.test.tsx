import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import MobileOAuthCallbackPage from "./MobileOAuthCallbackPage";

afterEach(cleanup);

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MobileOAuthCallbackPage />
    </MemoryRouter>,
  );

it("returns the query to the production Android app", () => {
  window.happyDOM.setURL(
    "https://worldalliance.org/mobile/oauth-callback?handoff=abc",
  );
  renderAt("/mobile/oauth-callback?handoff=abc");

  fireEvent.click(screen.getByText("Return to the app"));

  expect(window.location.href).toBe(
    "intent://worldalliance.org/mobile/oauth-callback?handoff=abc#Intent;scheme=https;package=com.alliance.alliancemobile;end",
  );
});

it("offers no way back without a query", () => {
  renderAt("/mobile/oauth-callback");

  expect(screen.queryByText("Return to the app")).toBeNull();
  expect(screen.getByText(/We couldn't finish signing you in/)).toBeDefined();
});
