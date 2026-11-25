import type { UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import { makeCommunity, makeUser } from "@alliance/shared/lib/testFixtures";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { MemberSheet } from "./MemberSheet";

const north = makeCommunity({ id: 4, name: "North" });

const sam: UserAdminDetailDto = {
  ...makeUser({
    id: 7,
    name: "Sam",
    email: "sam@example.com",
    hasActiveContract: true,
  }),
  communities: [{ ...north, users: [], leaders: [] }],
  leaderOfIds: [4],
  tags: [],
  location: { cityName: "Oslo", countryName: "Norway" },
  invitedBy: null,
};

let detailStatus: number;
let awayStatus: number;

serveApi(
  routes({
    "GET /user/userdetail/:id": () =>
      detailStatus === 200
        ? Response.json(sam)
        : Response.json(
            { message: "User not found" },
            { status: detailStatus },
          ),
    "GET /user/awayranges/:id": () =>
      awayStatus === 200
        ? Response.json([])
        : Response.json({}, { status: awayStatus }),
  }),
);

beforeEach(() => {
  detailStatus = 200;
  awayStatus = 200;
});

const renderSheet = (onClose = () => {}) => {
  const { client, wrapper } = queryWrapper();
  render(
    <MemoryRouter>
      <MemberSheet
        userId={7}
        onClose={onClose}
        headerActions={<button type="button">Next</button>}
      />
    </MemoryRouter>,
    { wrapper },
  );
  return client;
};

it("shows who the member is, how to reach them and where they stand", async () => {
  renderSheet();

  const sheet = within(await screen.findByRole("dialog", { name: "Sam" }));
  expect(sheet.getByText("sam@example.com")).toBeTruthy();
  expect(sheet.getByRole("link", { name: "North" }).getAttribute("href")).toBe(
    "/members/groups/4",
  );
  expect(sheet.getByText("Leader")).toBeTruthy();
  expect(sheet.getByText("Oslo, Norway")).toBeTruthy();
  expect(await sheet.findByText("No")).toBeTruthy();
});

it("opens the full record and keeps the list's own controls", async () => {
  renderSheet();

  const sheet = within(await screen.findByRole("dialog", { name: "Sam" }));
  expect(sheet.getByRole("link", { name: "Open" }).getAttribute("href")).toBe(
    "/members/7",
  );
  expect(sheet.getByRole("button", { name: "Next" })).toBeTruthy();
});

it("shows its loading state first", () => {
  renderSheet();

  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
});

it("says a member that does not exist was not found", async () => {
  detailStatus = 404;
  renderSheet();

  expect(await screen.findByText("Member not found")).toBeTruthy();
});

it("says the member failed to load", async () => {
  detailStatus = 500;
  renderSheet();

  expect(await screen.findByText("Couldn't load this member")).toBeTruthy();
});

it("says whether they are away couldn't be loaded", async () => {
  awayStatus = 500;
  renderSheet();

  const sheet = within(await screen.findByRole("dialog", { name: "Sam" }));
  expect((await sheet.findByRole("alert")).textContent).toContain(
    "Couldn't load Sam's away periods",
  );
});

it("names their away periods when those fail to refresh", async () => {
  const client = renderSheet();
  const sheet = within(await screen.findByRole("dialog", { name: "Sam" }));
  await sheet.findByText("No");
  awayStatus = 500;

  void client.refetchQueries({ queryKey: queryKeys.userAwayRangesAdmin(7) });

  expect(
    await sheet.findByText(/Couldn't refresh their away periods\./),
  ).toBeTruthy();
  expect(sheet.queryByText(/this member/)).toBe(null);
});

it("closes from its close button", async () => {
  const closed: true[] = [];
  renderSheet(() => closed.push(true));

  fireEvent.click(await screen.findByRole("button", { name: "Close" }));

  expect(closed).toEqual([true]);
});

it("leaves the page behind it usable, and closes on Escape", async () => {
  const closed: true[] = [];
  render(
    <MemoryRouter>
      <button type="button">Behind</button>
      <MemberSheet userId={7} onClose={() => closed.push(true)} />
    </MemoryRouter>,
    queryWrapper(),
  );
  const sheet = await screen.findByRole("dialog", { name: "Sam" });
  await waitFor(() =>
    expect(sheet.contains(document.activeElement)).toBe(true),
  );

  const behind = screen.getByRole("button", { name: "Behind" });
  fireEvent.pointerDown(behind);
  fireEvent.click(behind);
  expect(closed).toEqual([]);

  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  expect(closed).toEqual([true]);
});
