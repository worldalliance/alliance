import type { UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AuthProvider } from "../lib/AuthContext";
import { queryClient } from "../lib/queryClient";
import UserDetailView, { clientLoader } from "./UserDetailView";

const sam: UserAdminDetailDto = {
  ...makeUser({ id: 7, name: "Sam", hasActiveContract: true }),
  communities: [],
  tags: [],
  location: {},
  invitedBy: null,
};

let detailStatus: number;
let memberRequested: () => void;
let memberRequest: Promise<void>;

serveApi(
  routes(
    {
      "GET /user/userdetail/:id": () => {
        memberRequested();
        return detailStatus === 200
          ? Response.json(sam)
          : Response.json(
              { message: "User not found" },
              { status: detailStatus },
            );
      },
      "PATCH /user/userdetail/:id/roles": () =>
        Response.json({ message: "Forbidden" }, { status: 400 }),
      "POST /contract/admin/suspend/:userId": () =>
        Response.json(
          { message: "Member does not have an active contract." },
          { status: 400 },
        ),
      // Answers only once the member is requested, so a member fetch that
      // waits for the loader never starts.
      "GET /user/tag-summaries": async () => {
        await memberRequest;
        return Response.json([]);
      },
      "GET /actions/action-relations/:userId": () =>
        Response.json({ actions: [], users: [] }),
      "GET /notifs/for-user/:id": () => Response.json([]),
      "POST /tasks/formsForUserSID/:userId": () => Response.json([]),
      "GET /user/listfriends/:id": () => Response.json([]),
    },
    // The sections a loaded member renders load their own data.
    () => Response.json({}, { status: 404 }),
  ),
);

beforeAll(() => queryClient.setDefaultOptions({ queries: { retry: false } }));

beforeEach(() => {
  detailStatus = 404;
  memberRequest = new Promise((resolve) => {
    memberRequested = resolve;
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

const renderPage = () => {
  const router = createMemoryRouter(
    [
      {
        path: "/members/:userId",
        Component: UserDetailView,
        loader: (args) =>
          clientLoader({
            ...args,
            params: { userId: args.params.userId ?? "" },
          }),
      },
    ],
    { initialEntries: ["/members/7"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

const cacheSam = (overrides: Partial<UserAdminDetailDto> = {}) =>
  queryClient.setQueryData(queryKeys.userDetailAdmin(7), {
    ...sam,
    ...overrides,
  });

it("loads the member alongside the rest of the page", async () => {
  detailStatus = 200;
  renderPage();

  expect(await screen.findByRole("heading", { name: "Sam" })).toBeTruthy();
});

it("loads the member afresh over one cached moments ago", async () => {
  detailStatus = 200;
  cacheSam({ name: "Sam Before" });
  renderPage();

  expect(await screen.findByRole("heading", { name: "Sam" })).toBeTruthy();
});

it("says a member that does not exist was not found", async () => {
  renderPage();

  expect(await screen.findByText("Member not found")).toBeTruthy();
});

it("says the member failed to load", async () => {
  detailStatus = 500;
  renderPage();

  expect(await screen.findByText("Failed to load member")).toBeTruthy();
});

it("replaces a cached member who has since been deleted", async () => {
  cacheSam();
  renderPage();

  expect(await screen.findByText("Member not found")).toBeTruthy();
});

it("keeps a cached member it could not refresh and says so", async () => {
  detailStatus = 500;
  cacheSam();
  renderPage();

  expect(
    await screen.findByText(
      "Could not refresh this member. Reload to see their latest details.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Sam" })).toBeTruthy();
});

it("says when a role change is refused", async () => {
  detailStatus = 200;
  renderPage();

  fireEvent.click(await screen.findByRole("checkbox", { name: "Staff" }));

  expect(
    await screen.findByText("Failed to update role. Try again."),
  ).toBeTruthy();
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", { name: "Staff" }).checked,
  ).toBe(false);
});

it("says when a suspension is refused instead of confirming it", async () => {
  detailStatus = 200;
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Suspend contract" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

  expect(
    await screen.findByText("Failed to suspend contract. Try again."),
  ).toBeTruthy();
  expect(screen.queryByText("Contract suspended")).toBeNull();
});
