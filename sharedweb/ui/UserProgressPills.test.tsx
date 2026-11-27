import type { UserActionSummaryDto } from "@alliance/shared/client";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { render, screen, within } from "@testing-library/react";
import { expect, it } from "bun:test";
import UserProgressPills, {
  ActionHistoryLegend,
  PILL_STATUS_DATA,
} from "./UserProgressPills";

const action = (id: number, name: string): UserActionSummaryDto => ({
  id,
  name,
  status: "member_action",
  weekNumber: null,
  allMembersParticipating: false,
  memberActionDeadline: null,
});

it("names each drawn bar as an image of its action, status and deadline", () => {
  render(
    <UserProgressPills
      actions={[action(1, "Call a rep"), action(2, "Skip me")]}
      maxActionsPerWeek={null}
      relationByActionId={{
        1: { actionId: 1, status: "completed" },
        2: { actionId: 2, status: "not_required" },
      }}
    />,
  );
  expect(
    screen.getByRole("img", { name: "Call a rep - Completed. No deadline" }),
  ).toBeTruthy();
  expect(screen.queryByRole("img", { name: /Skip me/ })).toBeNull();
});

it("names a bar in its tooltip's words", () => {
  render(
    <UserProgressPills
      actions={[action(4, "Write a letter")]}
      maxActionsPerWeek={null}
      relationByActionId={{ 4: { actionId: 4, status: "todo" } }}
    />,
  );
  expect(
    screen.getByRole("img", {
      name: "Write a letter - Not yet completed. No deadline",
    }),
  ).toBeTruthy();
});

it("names a bar's deadline in its tooltip's format", () => {
  const deadline = Date.UTC(2026, 2, 2, 17);
  render(
    <UserProgressPills
      actions={[{ ...action(5, "Phone bank"), memberActionDeadline: deadline }]}
      maxActionsPerWeek={null}
      relationByActionId={{ 5: { actionId: 5, status: "completed" } }}
    />,
  );
  expect(
    screen.getByRole("img", {
      name: `Phone bank - Completed. Due ${formatDateTime(new Date(deadline))}`,
    }),
  ).toBeTruthy();
});

it.each([
  [
    "names why a member won't complete an action ungrouped",
    null,
    null,
    ": Other reason",
  ],
  [
    "leaves the reason out of week-grouped bars, which peers see",
    { 2: 1 },
    2,
    "",
  ],
])("%s", (_, maxActionsPerWeek, weekNumber, reason) => {
  render(
    <UserProgressPills
      actions={[{ ...action(3, "March"), weekNumber }]}
      maxActionsPerWeek={maxActionsPerWeek}
      relationByActionId={{ 3: { actionId: 3, status: "wont_complete" } }}
    />,
  );
  expect(
    screen.getByRole("img", {
      name: `March - Won't complete${reason}. No deadline`,
    }),
  ).toBeTruthy();
});

it("keys each drawn colour by the words its tooltip uses", () => {
  render(<ActionHistoryLegend />);
  const key = screen.getByRole("list", { name: "Action history key" });
  const items = within(key).getAllByRole("listitem");
  expect(items.map((item) => item.textContent)).toEqual([
    "Member away",
    "Completed",
    "Missed deadline",
    "Not yet completed",
    "Won't complete",
    "Optional",
  ]);
  for (const item of items) {
    const style = Object.values(PILL_STATUS_DATA).find(
      (data) => data.pillSubtitleText === item.textContent,
    )?.pillStyle;
    if (!style) throw new Error(`no colour for ${item.textContent}`);
    expect(item.querySelector("span")?.className).toContain(style);
  }
});
