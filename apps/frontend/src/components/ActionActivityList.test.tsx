import { actionActivityDtoIsVisibleInFeed } from "@alliance/shared/lib/actionActivity";
import { makeActivity, makeProfile } from "@alliance/shared/lib/testFixtures";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { authValue } from "../testing/authValue";
import ActionActivityList from "./ActionActivityList";

const activity = (id: number, displayName: string, createdAt: string) => {
  const dto = makeActivity({
    id,
    createdAt,
    user: { ...makeProfile(id), displayName },
  });
  if (!actionActivityDtoIsVisibleInFeed(dto)) {
    throw new Error("fixture activity is not a feed activity");
  }
  return dto;
};

it("lists activities newest first without reordering the given array", () => {
  const activities = [
    activity(1, "Ada Lovelace", "2026-01-01T00:00:00.000Z"),
    activity(2, "Grace Hopper", "2026-01-02T00:00:00.000Z"),
  ];
  Object.freeze(activities);

  render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue()}>
        <ActionActivityList
          actionId={1}
          activities={activities}
          loading={false}
          onLikeActivity={() => Promise.resolve()}
          maxN={5}
        />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  expect(
    screen.getAllByText(/Lovelace|Hopper/).map((el) => el.textContent),
  ).toEqual(["Grace Hopper", "Ada Lovelace"]);
});
