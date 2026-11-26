import { cleanup, screen, within } from "@testing-library/react";
import { makeParsedAction } from "../../../lib/testing/parsedAction";
import { SaveState } from "../../../ui/templates/Form";
import { detailsSaveNote, detailsSaveState } from "./detailsRules";
import {
  fieldKinds,
  fieldNames,
  options,
  renderForm,
  section,
} from "./renderDetailsForm";

describe("TaskDetailsForm", () => {
  it("renders each field in its section", () => {
    renderForm();

    expect(fieldNames("Content")).toEqual([
      "name",
      "shortDescription",
      "body",
      "image",
      "squareThumbnailImage",
      "squareThumbnailImageAlt",
    ]);
    expect(fieldNames("Setup")).toEqual([
      "suiteId",
      "taskKind",
      "timeEstimate",
    ]);
    expect(fieldNames("Who takes part")).toEqual(["onboarding"]);
    expect(fieldNames("Who can see it")).toEqual([
      "visibilityMode",
      "staffPreview",
      "publicOnly",
    ]);
    expect(fieldNames("Completion")).toEqual([
      "optional",
      "shouldCompleteAfterDeadline",
      "preventCompletion",
    ]);
    expect(fieldNames("Forum participation")).toEqual([
      "isForumParticipationAction",
      "forumParticipationPostId",
      "forumParticipationIncludeChildren",
    ]);
    expect(fieldNames("Custom stat")).toEqual([
      "customStatType",
      "customStatGoal",
      "customStatLabel",
    ]);

    expect(fieldKinds("Content")).toEqual([
      "textarea",
      "textarea",
      "textarea",
      "file",
      "text",
      "text",
    ]);
    expect(fieldKinds("Setup")).toEqual(["select", "select", "number"]);
    expect(fieldKinds("Who can see it")).toEqual([
      "select",
      "checkbox",
      "checkbox",
    ]);
    expect(fieldKinds("Custom stat")).toEqual(["select", "number", "text"]);
    expect(screen.getByLabelText<HTMLInputElement>("Cover image").accept).toBe(
      "image/*",
    );

    const content = within(section("Content"));
    expect(content.getByText("Authors")).toBeTruthy();
    expect(content.getByRole("group", { name: "Reviewed by" })).toBeTruthy();
    expect(
      within(section("Setup")).getByRole("group", { name: "Category" }),
    ).toBeTruthy();
    expect(
      within(section("Setup"))
        .getByRole("link", { name: "Manage priority" })
        .getAttribute("href"),
    ).toBe("/tasks?view=priority");
  });

  it("marks the name required and leaves the descriptions optional, since drafts save without them", () => {
    renderForm();

    const required = (label: RegExp) =>
      screen.getByLabelText<HTMLTextAreaElement>(label).required;
    expect(required(/^Name/)).toBe(true);
    expect(screen.getByText("(required)")).toBeTruthy();
    expect(required(/^Short description/)).toBe(false);
    expect(required(/^Task page description/)).toBe(false);
  });

  it("asks for a name under the field when a blank one is refused", () => {
    renderForm({ editor: { nameMissing: true } });

    expect(screen.getByLabelText(/^Name/).getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(screen.getByText("Enter a name")).toBeTruthy();
  });

  it("opens a rarely used group when one of its fields is set", () => {
    renderForm();

    const open = (title: string) =>
      screen.queryByRole("button", { name: title, expanded: true }) !== null;
    expect(open("Forum participation")).toBe(false);
    expect(open("Custom stat")).toBe(true);

    cleanup();
    renderForm({
      form: { customStatType: "none", isForumParticipationAction: true },
    });
    expect(open("Forum participation")).toBe(true);
    expect(open("Custom stat")).toBe(false);
  });

  it("leaves out Staff preview when the page controls it", () => {
    renderForm({ hideStaffPreview: true });

    expect(fieldNames("Who can see it")).toEqual([
      "visibilityMode",
      "publicOnly",
    ]);
  });

  it("disables the custom stat fields without a stat type and the forum override off forum participation tasks", () => {
    renderForm({ form: { customStatType: "none" } });

    const disabled = (label: RegExp) =>
      screen.getByLabelText<HTMLInputElement>(label).disabled;
    expect(disabled(/^Custom stat goal/)).toBe(true);
    expect(disabled(/^Custom stat label/)).toBe(true);
    expect(disabled(/^Forum post ID/)).toBe(true);
    expect(disabled(/^Include child replies/)).toBe(true);

    cleanup();
    renderForm({ form: { isForumParticipationAction: true } });
    expect(disabled(/^Custom stat goal/)).toBe(false);
    expect(disabled(/^Forum post ID/)).toBe(false);
    expect(disabled(/^Include child replies/)).toBe(false);
  });

  it("shows each choice's options", () => {
    renderForm();

    expect(options("Suite")).toEqual([["", "No suite"]]);
    expect(options("Visibility once launched")).toEqual([
      ["all_members", "All members"],
      ["participating_groups", "Participating groups"],
      ["public", "Public"],
    ]);
    expect(options("Task type")).toEqual([
      ["form", "Form"],
      ["kora_review", "Kora review"],
    ]);
    expect(options("Custom stat type")).toEqual([
      ["none", "None"],
      ["users_invited", "Users invited"],
    ]);
  });

  it("says what the chosen visibility mode shows once launched", () => {
    renderForm({ form: { visibilityMode: "public" } });

    expect(
      screen.getByText(/^Once launched, anyone can open and see it/),
    ).toBeTruthy();
  });

  it("warns that a stored cohort it couldn't read would be erased by a save", () => {
    renderForm();
    expect(
      screen.queryByText(/^The stored cohort couldn't be read/),
    ).toBeNull();

    cleanup();
    renderForm({ cohortParseFailed: true });
    expect(
      screen
        .getByText(/^The stored cohort couldn't be read/)
        .closest('[role="alert"]'),
    ).toBeTruthy();
  });
});

describe("detailsSaveNote", () => {
  const form = { publicOnly: false, staffPreview: false };
  const task = makeParsedAction({});

  it("says a save on a live task reaches members at once", () => {
    expect(detailsSaveNote({ ...task, status: "member_action" }, form)).toBe(
      "This task is live: a save reaches members at once.",
    );
    expect(
      detailsSaveNote(
        { ...task, status: "member_action", archived: true },
        form,
      ),
    ).toBe("");
  });

  it("names who sees a draft's save from what the save stores", () => {
    const draft = { ...task, status: "draft" as const, archived: false };
    const archived = { ...draft, archived: true };
    expect(detailsSaveNote(draft, form)).toBe("");
    expect(detailsSaveNote(draft, { ...form, staffPreview: true })).toBe(
      "Staff preview is on: staff see a save at once.",
    );
    expect(detailsSaveNote(archived, { ...form, staffPreview: true })).toBe("");
    expect(detailsSaveNote(archived, { ...form, publicOnly: true })).toMatch(
      /^Its page opens to anyone with the link/,
    );
  });

  it("drops the exposure a save turns off", () => {
    const stored = makeParsedAction({ publicOnly: true, staffPreview: true });
    expect(detailsSaveNote({ ...stored, status: "draft" }, form)).toBe("");
  });

  it("says what creating exposes", () => {
    expect(detailsSaveNote(null, form)).toMatch(
      /^Creates a draft with no events/,
    );
    expect(detailsSaveNote(null, { ...form, publicOnly: true })).toMatch(
      /opens at once to anyone with the link/,
    );
  });
});

describe("detailsSaveState", () => {
  const editor = { saveError: null, dirty: false, justSaved: false };

  it("leads with the write in flight, then a failure, then unsaved edits", () => {
    expect(
      detailsSaveState({ saving: true, editor: { ...editor, dirty: true } }),
    ).toBe(SaveState.Saving);
    expect(
      detailsSaveState({
        saving: false,
        editor: { ...editor, saveError: "No", dirty: true },
      }),
    ).toBe(SaveState.Failed);
    expect(
      detailsSaveState({ saving: false, editor: { ...editor, dirty: true } }),
    ).toBe(SaveState.Dirty);
    expect(
      detailsSaveState({
        saving: false,
        editor: { ...editor, justSaved: true },
      }),
    ).toBe(SaveState.Saved);
    expect(detailsSaveState({ saving: false, editor })).toBe(SaveState.Clean);
  });
});
