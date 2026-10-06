import type { AdminWaitlistEntryDto } from "@alliance/shared/client/types.gen";
import * as config from "@alliance/sharedweb/lib/config";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, jest } from "bun:test";
import EntryContactActions from "./EntryContactActions";

const phoneEntry: AdminWaitlistEntryDto = {
  id: 7,
  name: "Phone Person",
  email: null,
  phoneNumber: "+14155552671",
  shareCode: "share7",
  reason: null,
  organization: null,
  sourceLink: null,
  referrer: null,
  createdAt: "2026-09-01T12:00:00.000Z",
  mobilizedAt: null,
  unsubscribedAt: null,
  spamStatus: "clean",
  inviteState: "claimed",
  tags: [],
  contractEvents: [],
};

beforeEach(() => {
  jest.spyOn(config, "getInviteBaseUrl").mockReturnValue("https://site.test");
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

it("copies the referral link", async () => {
  const writeText = jest
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue();
  render(<EntryContactActions entry={phoneEntry} />);

  fireEvent.click(
    screen.getByRole("button", { name: "Referral link for Phone Person" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy referral link" }));

  await screen.findByText("Copied");
  expect(writeText).toHaveBeenCalledWith(
    "https://site.test/projects/democratic-grantmaking-26?ref=share7",
  );
});

it("shows the referral link and says when copying fails", async () => {
  jest
    .spyOn(navigator.clipboard, "writeText")
    .mockRejectedValue(new DOMException("denied"));
  render(<EntryContactActions entry={phoneEntry} />);

  fireEvent.click(
    screen.getByRole("button", { name: "Referral link for Phone Person" }),
  );

  const link = screen.getByLabelText<HTMLInputElement>("Referral link");
  expect(link.value).toBe(
    "https://site.test/projects/democratic-grantmaking-26?ref=share7",
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy referral link" }));
  await screen.findByText(/Couldn’t copy/);
});
