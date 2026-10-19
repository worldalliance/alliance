import type {
  KindSettingsDto,
  NotificationCellDto,
  NotificationChannel,
  NotificationKind,
} from "@alliance/shared/client";
import {
  resetChanges,
  type SettingChange,
} from "@alliance/shared/lib/notificationSettings";
import { makeKindSettings } from "@alliance/shared/lib/testFixtures";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import NotificationKindRow from "./NotificationKindRow";

afterEach(cleanup);

const likes = makeKindSettings({
  cells: [
    { channel: "in_app", override: null, enabled: true, editable: true },
    { channel: "push", override: false, enabled: false, editable: true },
  ],
});

const renderRow = (
  kind: KindSettingsDto,
  failed: Partial<Record<NotificationChannel, boolean | null>> = {},
) => {
  const saved: (readonly SettingChange[])[] = [];
  const shownOverride = (_: NotificationKind, cell: NotificationCellDto) =>
    cell.channel in failed ? (failed[cell.channel] ?? null) : cell.override;
  render(
    <NotificationKindRow
      kind={kind}
      save={(changes) => saved.push(changes)}
      retry={() => {}}
      statusOf={() => null}
      shownOverride={shownOverride}
      resetOf={(row) =>
        resetChanges({
          ...row,
          cells: row.cells.map((cell) => ({
            ...cell,
            override: shownOverride(row.kind, cell),
          })),
        })
      }
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Likes|Contract/ }));
  return saved;
};

it("expands to the example and saves the choice made", () => {
  const saved = renderRow(likes);

  expect(screen.getByText("Jordan Ellis liked your post")).toBeTruthy();
  expect(screen.getByText("Currently off · your setting")).toBeTruthy();
  fireEvent.click(
    within(screen.getByRole("group", { name: "Likes by In-app" })).getByRole(
      "button",
      { name: "Off" },
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

  expect(saved).toEqual([
    [{ type: "cell", kind: "likes", channel: "in_app", value: false }],
    [{ type: "cell", kind: "likes", channel: "push", value: null }],
  ]);
});

it("shows a failed choice on its control and resets it", () => {
  const saved = renderRow(likes, { in_app: false });

  expect(
    within(screen.getByRole("group", { name: "Likes by In-app" })).getByRole(
      "button",
      { name: "Off", pressed: true },
    ),
  ).toBeTruthy();
  expect(screen.getByText("Currently on · from default")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

  expect(saved).toEqual([
    [
      { type: "cell", kind: "likes", channel: "in_app", value: null },
      { type: "cell", kind: "likes", channel: "push", value: null },
    ],
  ]);
});

it("saves nothing for the choice already made", () => {
  const saved = renderRow(likes);

  fireEvent.click(
    within(screen.getByRole("group", { name: "Likes by Push" })).getByRole(
      "button",
      { name: "Off" },
    ),
  );

  expect(saved).toEqual([]);
});

it("locks a required kind to the defaults", () => {
  renderRow({
    ...likes,
    kind: "contract_suspended",
    label: "Contract suspended",
    required: true,
    cells: [
      { channel: "push", override: null, enabled: true, editable: false },
    ],
  });

  expect(screen.getByText("Always follows your defaults")).toBeTruthy();
  expect(screen.queryByRole("group")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Reset to defaults" }),
  ).toBeNull();
});
