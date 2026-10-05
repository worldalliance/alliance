import type { OnetimeInviteListDto } from "@alliance/shared/client";
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
import { MemoryRouter } from "react-router";
import InvitesPage from "./InvitesPage";

afterEach(cleanup);

const created: unknown[] = [];
let createReleased = Promise.resolve();

serveApi(
  routes({
    "GET /user/onetimeInvites": ({ request }) =>
      Response.json({
        items: [
          {
            id: 1,
            invitee: "Sam",
            code: "abc123",
            createdAt: "2026-01-02T00:00:00.000Z",
            status: "link_unused",
            invitedUserId: null,
          },
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
      created.push(await request.json());
      await createReleased;
      return Response.json({});
    },
  }),
);

afterEach(() => {
  created.length = 0;
  createReleased = Promise.resolve();
});

const renderPage = () =>
  render(
    <MemoryRouter>
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
    await screen.findByRole("button", { name: "Copy invite link abc123" }),
  );

  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      "https://test.alliance/signup?ref=abc123",
    ),
  );
  expect(await screen.findByText("Invite link copied")).toBeTruthy();
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

  fireEvent.change(screen.getByPlaceholderText(/preferably a first name/), {
    target: { value: "Alex" },
  });
  fireEvent.change(screen.getByPlaceholderText(/search/i), {
    target: { value: "Jor" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Jordan" }));
  const createButton = screen.getByRole("button", { name: "Create Invite" });
  fireEvent.click(createButton);
  await waitFor(() => expect(createButton.hasAttribute("disabled")).toBe(true));
  fireEvent.click(createButton);
  releaseCreate();

  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "1" }).getAttribute("aria-current"),
    ).toBe("page"),
  );
  expect(created).toEqual([{ invitingUserId: 3, invitee: "Alex" }]);
  expect(screen.queryByRole("button", { name: "Jordan" })).toBeNull();
  expect(screen.queryByText("Jordan")).toBeNull();
});
