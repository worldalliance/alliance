import { makeNotificationSettings } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import NotificationSectionPage from "./NotificationSectionPage";

serveApi(
  routes({
    "GET /user/notification-settings": () =>
      Response.json(makeNotificationSettings()),
  }),
);

afterEach(cleanup);

const renderAt = (section: string) => {
  const { wrapper } = queryWrapper();
  render(
    <MemoryRouter initialEntries={[`/settings/notifications/${section}`]}>
      <Routes>
        <Route
          path="/settings/notifications/:section"
          element={<NotificationSectionPage />}
        />
      </Routes>
    </MemoryRouter>,
    { wrapper },
  );
};

it("lists the section's kinds", async () => {
  renderAt("friends_and_likes");

  expect(await screen.findByRole("button", { name: /Likes/ })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Friends & likes" })).toBeTruthy();
});

it("says when there's no such section", () => {
  renderAt("nope");

  expect(
    screen.getByText("There's no such group of notifications."),
  ).toBeTruthy();
});

it("says when none of a section's kinds apply to the member", async () => {
  renderAt("groups");

  expect(
    await screen.findByText("None of these notifications apply to you."),
  ).toBeTruthy();
});
