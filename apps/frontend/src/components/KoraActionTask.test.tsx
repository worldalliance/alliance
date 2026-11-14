import { KORA_REVIEW_PATH } from "@alliance/common/kora";
import { KORA_ACTION_COPY } from "@alliance/shared/lib/koraAction";
import { makeAction, makeViewer } from "@alliance/shared/lib/testFixtures";
import { render, screen } from "@testing-library/react";
import { expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import KoraActionTask from "./KoraActionTask";

const renderTask = (action: ReturnType<typeof makeAction>) =>
  render(
    <MemoryRouter>
      <KoraActionTask action={action} />
    </MemoryRouter>,
  );

test("sends a member who hasn't finished to the review page", () => {
  renderTask(makeAction({ taskKind: "kora_review", timeEstimate: 15 }));

  screen.getByText(KORA_ACTION_COPY.intro(15));
  expect(
    screen
      .getByRole("link", { name: KORA_ACTION_COPY.start })
      .getAttribute("href"),
  ).toBe(KORA_REVIEW_PATH);
});

test("offers to keep reviewing once the action is complete", () => {
  renderTask(
    makeAction({
      taskKind: "kora_review",
      viewer: makeViewer({ relation: "completed" }),
    }),
  );

  screen.getByRole("heading", { name: KORA_ACTION_COPY.completeHeading });
  screen.getByText(KORA_ACTION_COPY.continueNote);
  expect(
    screen
      .getByRole("link", { name: KORA_ACTION_COPY.reviewMore })
      .getAttribute("href"),
  ).toBe(KORA_REVIEW_PATH);
});

test("offers no start link when the member can't complete the action", () => {
  renderTask(
    makeAction({
      taskKind: "kora_review",
      viewer: makeViewer({ canComplete: false }),
    }),
  );
  expect(
    screen.queryByRole("link", { name: KORA_ACTION_COPY.start }),
  ).toBeNull();
});
