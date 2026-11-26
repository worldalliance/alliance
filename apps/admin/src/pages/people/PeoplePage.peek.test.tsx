import type {
  ContractEventDto,
  StaffDirectoryEntryDto,
  UserDto,
} from "@alliance/shared/client";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, jest } from "bun:test";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { answerLeaveGuard } from "../../lib/testing/leaveGuard";
import { ToastProvider } from "../../ui/ToastProvider";
import PeoplePage from "./PeoplePage";

const signed: ContractEventDto = {
  type: "signed",
  date: "2026-01-01T00:00:00.000Z",
  automatic: false,
  contractId: null,
};
const people = [
  makeUser({ id: 1, name: "Ada", email: "ada@example.com" }),
  makeUser({ id: 2, name: "Grace", email: "grace@example.com" }),
  makeUser({ id: 3, name: "Lin", email: "lin@example.com" }),
];
const users: UserDto[] = people.map((user) => ({
  ...user,
  lastContractEvent: signed,
}));
const staff = people.map(
  (user, index) =>
    ({
      id: user.id,
      displayName: user.name,
      profilePicture: null,
      staffTitle: null,
      staffLink: null,
      staffDisplayOrder: index,
    }) satisfies StaffDirectoryEntryDto,
);

serveApi(
  routes({
    "GET /user/list": () => Response.json(users),
    "GET /analytics/time-spent-per-user-total": () => Response.json([]),
    "GET /user/tags": () => Response.json([]),
    "GET /actions/action-relations": () =>
      Response.json({ actions: [], suites: [], users: [] }),
    "GET /community/memberContactInfo": () => Response.json([]),
    "GET /user/staff-directory-admin": () => Response.json(staff),
    "GET /user/admin/awayranges": () =>
      Response.json(
        [3, 1].map((userId) => ({
          id: userId,
          userId,
          userName: people.find((user) => user.id === userId)?.name,
          startDate: "2030-03-05T08:00:00.000Z",
          endDate: "2030-03-12T07:00:00.000Z",
          reason: "vacation",
          note: null,
          createdAt: "2030-01-01T00:00:00.000Z",
        })),
      ),
    "GET /user/userdetail/:id": ({ params }) => {
      const user = people.find((person) => String(person.id) === params.id);
      return Response.json({
        ...user,
        communities: [],
        leaderOfIds: [],
        tags: [],
        location: { cityName: "Oslo", countryName: "Norway" },
        invitedBy: null,
      });
    },
    "GET /user/awayranges/:id": () => Response.json([]),
  }),
);

afterEach(() => jest.restoreAllMocks());

const renderPage = (url: string, { from }: { from?: string } = {}) => {
  const entries = from === undefined ? [url] : [from, url];
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Outlet />
          </LeaveGuard>
        ),
        children: [
          { path: "/members", element: <PeoplePage /> },
          { path: "/home", element: null },
        ],
      },
    ],
    { initialEntries: entries, initialIndex: entries.length - 1 },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    queryWrapper(),
  );
  return router;
};

const sheet = (name: string) => screen.findByRole("dialog", { name });
const step = (way: "Previous" | "Next") =>
  fireEvent.click(
    screen.getByRole("button", { name: `${way} member in the list` }),
  );
const stepButton = (way: "Previous" | "Next") =>
  screen.getByRole<HTMLButtonElement>("button", {
    name: `${way} member in the list`,
  });

it("opens the peek from a name on All and steps through the shown rows", async () => {
  const router = renderPage("/members");
  await screen.findByRole("link", { name: "Ada" });
  const order = screen
    .getAllByRole("link")
    .map((link) => link.textContent ?? "")
    .filter((text) => people.some((user) => user.name === text));
  expect(order).toHaveLength(3);

  fireEvent.click(screen.getByRole("link", { name: order[0] }));
  await sheet(order[0]);
  expect(stepButton("Previous").disabled).toBe(true);

  stepButton("Next").focus();
  step("Next");
  await sheet(order[1]);
  expect(document.activeElement).toBe(stepButton("Next"));
  step("Next");
  await sheet(order[2]);
  expect(stepButton("Next").disabled).toBe(true);
  expect(document.activeElement).toBe(stepButton("Previous"));
  step("Previous");
  await sheet(order[1]);

  await act(() => router.navigate(-1));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(router.state.location.search).toBe("");
});

it("opens and closes the peek on Staff without the leave prompt, keeping unsaved edits", async () => {
  const asked = answerLeaveGuard(false);
  const router = renderPage("/members?tab=staff");
  const [title] = await screen.findAllByPlaceholderText("Brief title");
  fireEvent.change(title, { target: { value: "Founder" } });

  fireEvent.click(screen.getByRole("link", { name: "Ada" }));
  await sheet("Ada");
  expect(router.state.location.search).toBe("?tab=staff&member=1");

  step("Next");
  const dialog = await sheet("Grace");
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  expect(asked).not.toHaveBeenCalled();
  expect(router.state.location.search).toBe("?tab=staff");
  expect(
    screen.getAllByPlaceholderText<HTMLInputElement>("Brief title")[0].value,
  ).toBe("Founder");
});

it("still asks before a tab switch drops unsaved Staff edits", async () => {
  const asked = answerLeaveGuard(false);
  const router = renderPage("/members?tab=staff");
  const [title] = await screen.findAllByPlaceholderText("Brief title");
  fireEvent.change(title, { target: { value: "Founder" } });

  await act(() => router.navigate("/members?tab=away"));

  expect(asked).toHaveBeenCalledTimes(1);
  expect(router.state.location.search).toBe("?tab=staff");
});

it("steps through Away's members in list order", async () => {
  renderPage(
    "/members?tab=away&from=2030-03-01T08:00:00.000Z&to=2030-03-31T07:00:00.000Z",
  );
  fireEvent.click(await screen.findByRole("link", { name: "Lin" }));
  await sheet("Lin");
  expect(stepButton("Previous").disabled).toBe(true);

  step("Next");
  await sheet("Ada");
  expect(stepButton("Next").disabled).toBe(true);
});

it("keeps the list usable beside the peek, and Back still closes it", async () => {
  const router = renderPage("/members");
  fireEvent.click(await screen.findByRole("link", { name: "Ada" }));
  await sheet("Ada");

  fireEvent.click(screen.getByRole("link", { name: "Grace" }));
  await sheet("Grace");
  expect(router.state.location.search).toBe("?member=2");

  await act(() => router.navigate(-1));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(router.state.location.search).toBe("");
});

it("keeps a search typed beside the peek on close, and one Back leaves People", async () => {
  const router = renderPage("/members", { from: "/home" });
  fireEvent.click(await screen.findByRole("link", { name: "Ada" }));
  await sheet("Ada");

  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search by name, email or phone" }),
    { target: { value: "a" } },
  );
  await waitFor(() =>
    expect(router.state.location.search).toBe("?member=1&q=a"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(router.state.location.search).toBe("?q=a"));

  await act(() => router.navigate(-1));
  expect(router.state.location.pathname).toBe("/home");
});

it("moves focus into the peek and back to the name on Escape", async () => {
  renderPage("/members");
  const name = await screen.findByRole("link", { name: "Ada" });
  name.focus();
  fireEvent.click(name);
  const dialog = await sheet("Ada");
  await waitFor(() =>
    expect(dialog.contains(document.activeElement)).toBe(true),
  );

  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Ada" }),
    ),
  );
});
