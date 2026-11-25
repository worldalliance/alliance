import type {
  OnetimeInviteListDto,
  OnetimeInviteStatus,
} from "@alliance/shared/client";
import { makeOnetimeInvite } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { onetimeInviteStatusDisplay } from "@alliance/shared/styles/inviteStatus";
import * as config from "@alliance/sharedweb/lib/config";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import { pickUser } from "../../ui/UserSelect.testing";
import InvitesPage from "./InvitesPage";

const created: unknown[] = [];
let createStatus = 200;
let createReleased = Promise.resolve();
let status: OnetimeInviteStatus = "link_unused";

serveApi(
  routes({
    "GET /user/onetimeInvites": ({ request }) =>
      Response.json({
        items: [
          makeOnetimeInvite({ createdAt: "2026-01-02T00:00:00.000Z", status }),
        ],
        totalCount: 51,
        page: Number(new URL(request.url).searchParams.get("page")),
        limit: 50,
        totalPages: 2,
      } satisfies OnetimeInviteListDto),
    "GET /user/onetimeInvites/memberStats": () => Response.json([]),
    "GET /user/list": () =>
      Response.json([{ id: 3, name: "Jordan", profilePicture: null }]),
    "POST /user/onetimeInvite/create": async ({ request }) => {
      if (createStatus !== 200)
        return Response.json(
          { message: "No such member" },
          { status: createStatus },
        );
      created.push(await request.json());
      await createReleased;
      return Response.json({});
    },
  }),
);

afterEach(() => {
  created.length = 0;
  createStatus = 200;
  createReleased = Promise.resolve();
  status = "link_unused";
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/growth/invites"]}>
      <ToastProvider>
        <InvitesPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("copies an invite's signup link from a labelled button and confirms it", async () => {
  jest
    .spyOn(config, "getInviteBaseUrl")
    .mockReturnValue("https://test.alliance/");
  const writeText = jest
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue();
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Copy link: invite abc123" }),
  );

  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      "https://test.alliance/signup?ref=abc123",
    ),
  );
  expect(await screen.findByText("Copied invite link")).toBeTruthy();
});

it("creates one invite per submit, clears the inviting user, and returns to the first page", async () => {
  let releaseCreate = () => {};
  createReleased = new Promise((resolve) => {
    releaseCreate = resolve;
  });
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "2" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "2" }).getAttribute("aria-current"),
    ).toBe("page"),
  );

  fireEvent.click(screen.getByRole("button", { name: "New invite…" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Invitee"), {
    target: { value: "Alex" },
  });
  await pickUser(dialog.getByPlaceholderText(/search/i), {
    query: "Jor",
    name: "Jordan",
  });
  const createButton = dialog.getByRole("button", { name: "Create invite" });
  fireEvent.click(createButton);
  await waitFor(() =>
    expect(createButton.getAttribute("aria-busy")).toBe("true"),
  );
  fireEvent.click(createButton);
  releaseCreate();

  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "1" }).getAttribute("aria-current"),
    ).toBe("page"),
  );
  expect(created).toEqual([{ invitingUserId: 3, invitee: "Alex" }]);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button", { name: "Jordan" })).toBeNull();
  expect(screen.queryByText("Jordan")).toBeNull();
});

it("says why an invite couldn't be created and keeps what was typed", async () => {
  createStatus = 400;
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "New invite…" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Invitee"), {
    target: { value: "Alex" },
  });
  await pickUser(dialog.getByPlaceholderText(/search/i), {
    query: "Jor",
    name: "Jordan",
  });
  fireEvent.click(dialog.getByRole("button", { name: "Create invite" }));

  expect((await dialog.findByRole("alert")).textContent).toBe("No such member");
  expect(dialog.getByLabelText<HTMLInputElement>("Invitee").value).toBe("Alex");
  expect(created).toEqual([]);
});

it("asks for the inviting member before creating an invite", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "New invite…" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Create invite" }));

  expect((await dialog.findByRole("alert")).textContent).toBe(
    "Choose the member who is inviting",
  );
  expect(created).toEqual([]);
});

it.each<OnetimeInviteStatus>([
  "link_unused",
  "link_used",
  "request_pending",
  "request_rejected",
])("shows a %s invite's shared status label", async (inviteStatus) => {
  status = inviteStatus;
  renderPage();

  expect(
    await screen.findByText(onetimeInviteStatusDisplay[inviteStatus].label),
  ).toBeTruthy();
});

it("names the per-member count for invites created, not sent", async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Invites per member" }),
  );
  expect(
    await screen.findByText("No invites in a member's name yet"),
  ).toBeTruthy();
});
