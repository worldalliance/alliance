import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { createMemoryRouter, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { ToastProvider } from "../../ui/ToastProvider";
import InvitesPage from "./InvitesPage";

const saved: string[] = [];
let saveStatus = 200;

serveApi(
  routes({
    "GET /share-urls/invite-message-template": () =>
      Response.json({ template: "Join me: {invite_link}" }),
    "PATCH /share-urls/invite-message-template": async ({ request }) => {
      if (saveStatus !== 200)
        return Response.json(
          { message: "template must contain {invite_link}" },
          { status: saveStatus },
        );
      const { template } = await request.json();
      saved.push(template);
      return Response.json({ template });
    },
  }),
);

afterEach(() => {
  saved.length = 0;
  saveStatus = 200;
});

const renderPage = () => {
  const router = createMemoryRouter(
    [
      {
        path: "/growth/invites",
        element: (
          <LeaveGuard>
            <InvitesPage />
          </LeaveGuard>
        ),
      },
    ],
    { initialEntries: ["/growth/invites?tab=template"] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    queryWrapper(),
  );
};

const message = () => screen.findByLabelText<HTMLTextAreaElement>("Message");

it("saves an edited message and confirms it", async () => {
  renderPage();
  expect((await message()).value).toBe("Join me: {invite_link}");
  fireEvent.change(await message(), {
    target: { value: "Come along: {invite_link}" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Invitation message saved")).toBeTruthy();
  expect(saved).toEqual(["Come along: {invite_link}"]);
});

it("asks for the link token before saving", async () => {
  renderPage();
  fireEvent.change(await message(), { target: { value: "Come along" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(
    await screen.findByText(
      "Include {invite_link} where the invite link should appear",
    ),
  ).toBeTruthy();
  expect(saved).toEqual([]);
});

it("says why the server refused a save and keeps the edit", async () => {
  saveStatus = 400;
  renderPage();
  fireEvent.change(await message(), {
    target: { value: "Come along: {invite_link}" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(
    await screen.findByText(
      "Couldn't save: template must contain {invite_link}",
    ),
  ).toBeTruthy();
  expect((await message()).value).toBe("Come along: {invite_link}");
});
