import type {
  AdminWaitlistEntryDto,
  WaitlistEntryInviteDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as config from "@alliance/sharedweb/lib/config";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, jest } from "bun:test";
import EntryContactActions, { InvitationDialog } from "./EntryContactActions";

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

let posts: { path: string; body: unknown }[];
let invite: WaitlistEntryInviteDto;

serveApi(
  routes({
    "POST /waitlist/admin/entries/:id/invite": ({ request }) => {
      posts.push({ path: new URL(request.url).pathname, body: null });
      return Response.json(invite);
    },
    "POST /waitlist/admin/entries/unsubscribe": async ({ request }) => {
      posts.push({
        path: new URL(request.url).pathname,
        body: await request.json(),
      });
      return Response.json({ changed: 1 });
    },
  }),
);

beforeEach(() => {
  posts = [];
  invite = { code: "inv123", issued: true, placement: "no_organization" };
  jest.spyOn(config, "getInviteBaseUrl").mockReturnValue("https://site.test");
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const renderActions = (
  entry: AdminWaitlistEntryDto,
  onInvite: () => void = () => {},
) =>
  render(
    <ToastProvider>
      <EntryContactActions entry={entry} onInvite={onInvite} />
    </ToastProvider>,
    queryWrapper(),
  );

const renderInvitation = (entry: AdminWaitlistEntryDto) => {
  const query = queryWrapper();
  render(
    <ToastProvider>
      <InvitationDialog entry={entry} onClose={() => {}} />
    </ToastProvider>,
    query,
  );
  return query.client;
};

it("copies the referral link", async () => {
  const writeText = jest
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue();
  renderActions(phoneEntry);

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
  renderActions(phoneEntry);

  fireEvent.click(
    screen.getByRole("button", { name: "Referral link for Phone Person" }),
  );

  const link = screen.getByLabelText<HTMLInputElement>("Referral link");
  expect(link.value).toBe(
    "https://site.test/projects/democratic-grantmaking-26?ref=share7",
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy referral link" }));
  await screen.findByText(/Couldn’t copy/);
  expect(posts).toEqual([]);
});

it("asks for the entry's invitation dialog", () => {
  const onInvite = jest.fn();
  renderActions(phoneEntry, onInvite);

  fireEvent.click(
    screen.getByRole("button", { name: "Signup invitation for Phone Person" }),
  );

  expect(onInvite).toHaveBeenCalledTimes(1);
});

it("shows the entry's state, then gets an invitation with its placement warning", async () => {
  renderInvitation({ ...phoneEntry, unsubscribedAt: "2026-09-02T00:00:00Z" });

  screen.getByText(/already claimed an invitation/);
  screen.getByText("This entry is unsubscribed.");
  expect(posts).toEqual([]);

  fireEvent.click(
    screen.getByRole("button", { name: "Get signup invitation" }),
  );

  const link = await screen.findByLabelText<HTMLInputElement>(
    "Signup invitation link",
  );
  expect(link.value).toBe("https://site.test/signup?ref=inv123");
  screen.getByText(/This invitation has no organization, so staff place/);
  expect(posts).toEqual([
    { path: "/waitlist/admin/entries/7/invite", body: null },
  ]);
});

it("refetches the entries once an invitation is issued", async () => {
  const client = renderInvitation(phoneEntry);
  const invalidate = jest.spyOn(client, "invalidateQueries");

  fireEvent.click(
    screen.getByRole("button", { name: "Get signup invitation" }),
  );

  await screen.findByLabelText("Signup invitation link");
  await waitFor(() => expect(invalidate).toHaveBeenCalled());
});

it("marks a subscribed phone entry unsubscribed after confirming", async () => {
  renderActions(phoneEntry);

  fireEvent.click(
    screen.getByRole("button", { name: "Mark unsubscribed: Phone Person" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  await waitFor(() =>
    expect(posts).toEqual([
      { path: "/waitlist/admin/entries/unsubscribe", body: { entryIds: [7] } },
    ]),
  );
});

it("offers no unsubscribe for an email or already unsubscribed entry", () => {
  renderActions({ ...phoneEntry, phoneNumber: null, email: "a@example.com" });
  expect(
    screen.queryByRole("button", { name: /Mark unsubscribed/ }),
  ).toBeNull();
  cleanup();
  renderActions({ ...phoneEntry, unsubscribedAt: "2026-09-02T00:00:00Z" });

  expect(
    screen.queryByRole("button", { name: /Mark unsubscribed/ }),
  ).toBeNull();
});
