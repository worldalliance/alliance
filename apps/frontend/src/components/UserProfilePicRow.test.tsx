import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import UserProfilePicRow from "./UserProfilePicRow";

it("shows at most three faces and counts the rest", () => {
  render(
    <MemoryRouter>
      <UserProfilePicRow
        users={Array.from({ length: 7 }, (_, i) => makeProfile(i + 1))}
      />
    </MemoryRouter>,
  );

  expect(document.querySelectorAll('[data-slot="avatar"]')).toHaveLength(3);
  expect(screen.getByText("+4")).toBeTruthy();
});
