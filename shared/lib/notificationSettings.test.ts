import type { NotificationSettingsDto } from "../client";
import {
  cellStatus,
  kindSummary,
  overrideCount,
  overrideCountNote,
  parseSection,
  receivesNothing,
  resetChanges,
  textNotice,
  TextNotice,
  updateBody,
  withChanges,
} from "./notificationSettings";
import { makeKindSettings, makeNotificationSettings } from "./testFixtures";

const likes = makeKindSettings({
  cells: [
    { channel: "in_app", override: null, enabled: true, editable: true },
    { channel: "push", override: false, enabled: false, editable: true },
  ],
});

const suspended = makeKindSettings({
  kind: "contract_suspended",
  label: "Contract suspended",
  section: "actions",
  required: true,
  example: "We've suspended your agreement",
  cells: [{ channel: "push", override: null, enabled: true, editable: false }],
});

const settings = makeNotificationSettings({
  defaults: { inApp: true, push: true, text: false, email: true },
  kinds: [likes, suspended],
});

const cellOf = (s: NotificationSettingsDto, kind: string, channel: string) =>
  s.kinds
    .find((k) => k.kind === kind)
    ?.cells.find((cell) => cell.channel === channel);

describe("withChanges", () => {
  it("moves the cells that follow a changed default and leaves overrides", () => {
    const changed = withChanges(settings, [
      { type: "default", channel: "push", value: false },
      { type: "default", channel: "in_app", value: false },
    ]);
    expect(changed.defaults.push).toBe(false);
    expect(cellOf(changed, "likes", "in_app")?.enabled).toBe(false);
    expect(cellOf(changed, "likes", "push")).toMatchObject({
      override: false,
      enabled: false,
    });
    expect(cellOf(changed, "contract_suspended", "push")?.enabled).toBe(false);
  });

  it("applies an override and a return to the default", () => {
    const changed = withChanges(settings, [
      { type: "cell", kind: "likes", channel: "in_app", value: false },
      { type: "cell", kind: "likes", channel: "push", value: null },
    ]);
    expect(cellOf(changed, "likes", "in_app")).toMatchObject({
      override: false,
      enabled: false,
    });
    expect(cellOf(changed, "likes", "push")).toMatchObject({
      override: null,
      enabled: true,
    });
  });
});

it("sends defaults and cells in one body", () => {
  expect(
    updateBody([
      { type: "default", channel: "in_app", value: false },
      { type: "cell", kind: "likes", channel: "push", value: null },
    ]),
  ).toEqual({
    defaults: { inApp: false },
    cells: [{ kind: "likes", channel: "push", override: null }],
  });
  expect(
    updateBody([{ type: "default", channel: "email", value: true }]),
  ).toEqual({ defaults: { email: true } });
});

it("counts the kinds with their own setting for a channel", () => {
  expect(overrideCount(settings, "push")).toBe(1);
  expect(overrideCount(settings, "in_app")).toBe(0);
  expect(overrideCountNote(0, "push")).toBeNull();
  expect(overrideCountNote(1, "push")).toBe(
    "1 notification has its own setting for Push",
  );
  expect(overrideCountNote(3, "text")).toBe(
    "3 notifications have their own setting for Text",
  );
});

describe("receivesNothing", () => {
  const allOff = withChanges(settings, [
    { type: "default", channel: "in_app", value: false },
    { type: "default", channel: "push", value: false },
    { type: "default", channel: "email", value: false },
  ]);

  it("warns when every default is off and no override is on", () => {
    expect(receivesNothing(settings)).toBe(false);
    expect(receivesNothing(allOff)).toBe(true);
  });

  it("doesn't warn while an override is on", () => {
    expect(
      receivesNothing(
        withChanges(allOff, [
          { type: "cell", kind: "likes", channel: "push", value: true },
        ]),
      ),
    ).toBe(false);
  });
});

it("says where a cell's value comes from", () => {
  expect(cellStatus(likes.cells[0])).toBe("Currently on · from default");
  expect(cellStatus(likes.cells[1])).toBe("Currently off · your setting");
});

it("summarizes a kind by the channels it's on", () => {
  expect(kindSummary(likes)).toBe("In-app");
  expect(
    kindSummary({
      ...likes,
      cells: likes.cells.map((cell) => ({ ...cell, enabled: false })),
    }),
  ).toBe("Off");
});

it("resets only the cells with an override", () => {
  expect(resetChanges(likes)).toEqual([
    { type: "cell", kind: "likes", channel: "push", value: null },
  ]);
  expect(resetChanges(suspended)).toEqual([]);
});

it("reports a missing number before a STOP", () => {
  expect(textNotice(settings)).toBeNull();
  expect(
    textNotice({
      ...settings,
      reachability: { textablePhoneNumber: true, textStopped: true },
    }),
  ).toBe(TextNotice.Stopped);
  expect(
    textNotice({
      ...settings,
      reachability: { textablePhoneNumber: false, textStopped: true },
    }),
  ).toBe(TextNotice.NoPhoneNumber);
});

it("parses only a known section", () => {
  expect(parseSection("groups")).toBe("groups");
  expect(parseSection("nope")).toBeNull();
  expect(parseSection(undefined)).toBeNull();
});
