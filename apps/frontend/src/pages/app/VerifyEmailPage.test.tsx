import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import VerifyEmailPage from "./VerifyEmailPage";

let verifyStatus: number | "unreachable" = 201;

serveApi(
  routes({
    "POST /user/verifyEmail": () => {
      if (verifyStatus === "unreachable")
        throw new TypeError("Failed to fetch");
      return new Response(null, { status: verifyStatus });
    },
  }),
);

afterEach(() => {
  cleanup();
  verifyStatus = 201;
});

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <VerifyEmailPage />
    </MemoryRouter>,
  );

it("confirms a verified email", async () => {
  renderAt("/verifyEmail?token=good");

  expect(
    await screen.findByText("Your email has been verified."),
  ).toBeDefined();
});

it("says the link is dead when the server refuses the token", async () => {
  verifyStatus = 400;
  renderAt("/verifyEmail?token=expired");

  expect(
    await screen.findByText(
      "This verification link has expired or is invalid.",
    ),
  ).toBeDefined();
});

it("says the link is dead when it has no token", async () => {
  renderAt("/verifyEmail");

  expect(
    await screen.findByText(
      "This verification link has expired or is invalid.",
    ),
  ).toBeDefined();
});

it("asks to retry when verification fails for another reason", async () => {
  verifyStatus = 500;
  renderAt("/verifyEmail?token=good");

  expect(
    await screen.findByText(
      "We couldn't verify your email. Try opening the link again.",
    ),
  ).toBeDefined();
});

it("asks to retry when the server can't be reached", async () => {
  verifyStatus = "unreachable";
  renderAt("/verifyEmail?token=good");

  expect(
    await screen.findByText(
      "We couldn't verify your email. Try opening the link again.",
    ),
  ).toBeDefined();
});
