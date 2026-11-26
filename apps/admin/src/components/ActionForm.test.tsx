import { cleanup, screen, within } from "@testing-library/react";
import {
  fieldKinds,
  fieldNames,
  gridNames,
  leafTexts,
  options,
  renderForm,
  section,
} from "../lib/testing/renderActionForm";

describe("ActionForm", () => {
  it("renders each field in its section, hiding those the form rules out", () => {
    renderForm();

    expect(fieldNames("Content")).toEqual([
      "name",
      "shortDescription",
      "body",
      "image",
      "squareThumbnailImage",
      "squareThumbnailImageAlt",
    ]);
    expect(fieldNames("Settings")).toEqual([
      "suiteId",
      "visibilityMode",
      "taskKind",
      "timeEstimate",
      "staffPreview",
    ]);
    expect(fieldNames("Audience")).toEqual(["onboarding", "publicOnly"]);
    expect(fieldNames("Completion")).toEqual([
      "shouldCompleteAfterDeadline",
      "preventCompletion",
      "optional",
    ]);
    expect(fieldNames("Forum participation")).toEqual([
      "isForumParticipationAction",
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
    expect(fieldKinds("Settings")).toEqual([
      "select",
      "select",
      "select",
      "number",
      "checkbox",
    ]);
    expect(fieldKinds("Custom stat")).toEqual(["select", "number", "text"]);
    expect(
      within(section("Settings")).getByRole("switch", {
        name: /^Staff preview/,
      }),
    ).toBeTruthy();

    expect(
      Array.from(section("Content").querySelectorAll("textarea"), (t) =>
        t.getAttribute("rows"),
      ),
    ).toEqual(["1", "2", "6"]);
    expect(screen.getByLabelText<HTMLInputElement>("Cover image").accept).toBe(
      "image/*",
    );

    expect(gridNames("Content")).toEqual([
      ["squareThumbnailImage", "squareThumbnailImageAlt"],
    ]);
    expect(gridNames("Settings")).toEqual([
      ["suiteId", "visibilityMode", "taskKind", "timeEstimate"],
      ["staffPreview"],
    ]);

    const content = within(section("Content"));
    expect(content.getByText("Action authors")).toBeTruthy();
    expect(content.getByText("Reviewed by")).toBeTruthy();
    expect(within(section("Settings")).getByText("Category")).toBeTruthy();
  });

  it("requires a name and leaves the descriptions optional, since drafts save without them", () => {
    renderForm();

    const required = (label: string) =>
      screen.getByLabelText<HTMLTextAreaElement>(label).required;
    expect(required("Name")).toBe(true);
    expect(required("Short description")).toBe(false);
    expect(required("Action page description")).toBe(false);
  });

  it("opens a rarely used section when one of its fields is set", () => {
    renderForm();

    const open = (title: string) =>
      screen.queryByRole("button", { name: title, expanded: true }) !== null;
    expect(open("Audience")).toBe(false);
    expect(open("Completion")).toBe(true);
    expect(open("Forum participation")).toBe(false);
    expect(open("Custom stat")).toBe(true);

    cleanup();
    renderForm({ form: { optional: false, customStatType: "none" } });
    expect(open("Completion")).toBe(false);
    expect(open("Custom stat")).toBe(false);
  });

  it("leaves out Staff preview when the page controls it", () => {
    renderForm({ props: { hideStaffPreview: true } });

    expect(fieldNames("Settings")).toEqual([
      "suiteId",
      "visibilityMode",
      "taskKind",
      "timeEstimate",
    ]);
  });

  it("hides the custom stat fields without a stat type and shows the forum override on forum participation actions", () => {
    renderForm({
      form: { customStatType: "none", isForumParticipationAction: true },
    });

    expect(fieldNames("Custom stat")).toEqual(["customStatType"]);
    expect(fieldNames("Forum participation")).toEqual([
      "forumParticipationPostId",
      "isForumParticipationAction",
      "forumParticipationIncludeChildren",
    ]);
    expect(leafTexts("Forum participation")).toEqual([
      "Forum post ID (override)",
      "Autocomplete based on replies to this post, ignoring any forum validator on the form. Leave blank to use the form's validator.",
      "Forum participation action",
      "Completes the action for members who comment but don't press complete",
      "Include child replies",
      "Also count replies to nested child posts of the override post",
    ]);
  });

  it("shows each field's label, help text, and options", () => {
    renderForm();

    const content = leafTexts("Content");
    expect(content.slice(0, content.indexOf("Action authors"))).toEqual([
      "Name",
      "Short description",
      "Action page description",
      "Cover image",
      "Square thumbnail URL",
      "Thumbnail alt text",
      "Left empty, the thumbnail is announced as the action name.",
    ]);
    expect(leafTexts("Settings")).toEqual([
      "Priority",
      "Category",
      "Suite",
      "Visibility mode",
      "Task",
      "Kora review sends members to review chatbot transcripts; the action completes when they finish their first assignment.",
      "Time estimate (min)",
      "Staff preview",
      "Staff see it on their home pages until the Member action event starts, or indefinitely if none is scheduled. Until then, nobody can submit, complete, withdraw, dismiss, like, or comment.",
    ]);
    expect(leafTexts("Audience")).toEqual([
      "Onboarding",
      "Members with a contract can complete it only if they signed their first one after the Member action event starts",
      "Public only",
      "For actions completed by non-members and not by members",
    ]);
    expect(leafTexts("Completion")).toEqual([
      "Complete after deadline",
      "Keeps it in the tasks view after the deadline passes",
      "Prevent completion",
      "Prevents members from completing the action even on the detail page",
      "Optional",
      "Shows a prominent dismiss option above the task card",
    ]);
    expect(leafTexts("Custom stat")).toEqual([
      "Custom stat type",
      "Custom stat goal",
      "Custom stat label",
    ]);
    expect(options("Suite")).toEqual([["", "No suite"]]);
    expect(options("Visibility mode")).toEqual([
      ["all_members", "All members"],
      ["participating_groups", "Participating groups"],
      ["public", "Public"],
    ]);
    expect(options("Custom stat type")).toEqual([
      ["none", "None"],
      ["users_invited", "Users invited"],
    ]);
  });

  it("says when the prerequisite tasks failed to load", () => {
    renderForm({ props: { allActionsLoadFailed: true } });
    expect(
      within(section("Prerequisites")).getByRole("option", {
        name: "Couldn't load tasks",
      }),
    ).toBeTruthy();
  });
});
