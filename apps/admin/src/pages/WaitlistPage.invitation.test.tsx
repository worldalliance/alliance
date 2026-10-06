import * as config from "@alliance/sharedweb/lib/config";
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, jest } from "bun:test";
import { api, renderPage, serveWaitlistApi } from "./WaitlistPage.testHarness";

serveWaitlistApi();

beforeEach(() => {
  jest.spyOn(config, "getInviteBaseUrl").mockReturnValue("https://site.test");
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("keeps an issued invitation on screen when the refetch drops its entry", async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Signup invitation for Person 1",
    }),
  );
  api.entriesServed = [];
  fireEvent.click(
    screen.getByRole("button", { name: "Get signup invitation" }),
  );

  await screen.findByText("No entries match.");
  expect(
    screen.getByLabelText<HTMLInputElement>("Signup invitation link").value,
  ).toBe("https://site.test/signup?ref=inv1");
});
