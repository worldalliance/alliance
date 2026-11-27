import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, it } from "bun:test";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AwayTab } from "./AwayTab";
import { MemberSheet } from "./MemberSheet";
import { useMemberPeek } from "./useMemberPeek";

serveApi(
  routes({
    "GET /user/admin/awayranges": () =>
      Response.json([
        {
          id: 1,
          userId: 10,
          userName: "Ana Lee",
          startDate: "2030-03-05T08:00:00.000Z",
          endDate: "2030-03-12T07:00:00.000Z",
          reason: "vacation",
          note: "Hiking",
          createdAt: "2030-01-01T00:00:00.000Z",
        },
      ]),
    "GET /user/userdetail/:id": () =>
      Response.json({
        ...makeUser({ id: 10, name: "Ana Lee", email: "ana@example.com" }),
        communities: [],
        leaderOfIds: [],
        tags: [],
        location: { cityName: "Oslo", countryName: "Norway" },
        invitedBy: null,
      }),
    "GET /user/awayranges/:id": () => Response.json([]),
  }),
);

function Page() {
  const peek = useMemberPeek();
  return (
    <>
      <AwayTab onOpenMember={peek.open} />
      {peek.memberId !== null && (
        <MemberSheet userId={peek.memberId} onClose={peek.close} />
      )}
    </>
  );
}

const renderPage = (url = "/members?tab=away&q=x") => {
  const router = createMemoryRouter([{ path: "/members", element: <Page /> }], {
    initialEntries: [url],
  });
  render(<RouterProvider router={router} />, queryWrapper());
  return router;
};

const search = (router: ReturnType<typeof renderPage>) =>
  router.state.location.search;

it("opens the peek on a plain click, keeping the list's params", async () => {
  const router = renderPage();
  const link = await screen.findByRole("link", { name: "Ana Lee" });
  expect(link.getAttribute("href")).toBe("/members/10");

  fireEvent.click(link);

  expect(await screen.findByRole("dialog", { name: "Ana Lee" })).toBeTruthy();
  expect(search(router)).toBe("?tab=away&q=x&member=10");
  expect(router.state.location.pathname).toBe("/members");
});

it("leaves a modified click to the link", async () => {
  const router = renderPage();
  fireEvent.click(await screen.findByRole("link", { name: "Ana Lee" }), {
    metaKey: true,
  });

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(search(router)).toBe("?tab=away&q=x");
});

it("closes with the close button, back to the list's own URL", async () => {
  const router = renderPage();
  fireEvent.click(await screen.findByRole("link", { name: "Ana Lee" }));
  fireEvent.click(await screen.findByRole("button", { name: "Close" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(search(router)).toBe("?tab=away&q=x");
});

it("closes on Back and reopens on Forward", async () => {
  const router = renderPage();
  fireEvent.click(await screen.findByRole("link", { name: "Ana Lee" }));
  await screen.findByRole("dialog", { name: "Ana Lee" });

  await act(() => router.navigate(-1));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(search(router)).toBe("?tab=away&q=x");

  await act(() => router.navigate(1));
  expect(await screen.findByRole("dialog", { name: "Ana Lee" })).toBeTruthy();
});

it("opens a member from a reloaded or pasted link, and closes it in place", async () => {
  const router = renderPage("/members?tab=away&member=10");
  expect(await screen.findByRole("dialog", { name: "Ana Lee" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(search(router)).toBe("?tab=away");
});
