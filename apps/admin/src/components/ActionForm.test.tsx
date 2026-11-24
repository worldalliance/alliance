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
        name: /^Staff Preview/,
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
    expect(content.getByText("Action Authors")).toBeTruthy();
    expect(content.getByText("Reviewed By")).toBeTruthy();
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

  it("leaves out Staff Preview when the page controls it", () => {
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
      "Forum Post ID (override)",
      "Autocomplete based on replies to this post, ignoring any forum validator on the form. Leave blank to use the form's validator.",
      "Forum Participation Action",
      "Autocomplete action for users who leave comment but dont hit complete",
      "Include child replies",
      "Also count replies to nested child posts of the override post",
    ]);
  });

  it("shows each field's label, help text, and options", () => {
    renderForm();

    const content = leafTexts("Content");
    expect(content.slice(0, content.indexOf("Action Authors"))).toEqual([
      "Name",
      "Short description",
      "Action page description",
      "Cover image",
      "Square Thumbnail URL",
      "Thumbnail Alt Text",
      "Left empty, the thumbnail is announced as the action name.",
    ]);
    expect(leafTexts("Settings")).toEqual([
      "Priority",
      "Category",
      "Suite",
      "Visibility Mode",
      "Task",
      "Kora review sends members to review chatbot transcripts; the action completes when they finish their first assignment.",
      "Time Estimate (min)",
      "Staff Preview",
      "Staff see it on their home pages until the Member Action event starts, or indefinitely if none is scheduled. Until then, nobody can submit, complete, withdraw, dismiss, like, or comment.",
    ]);
    expect(leafTexts("Audience")).toEqual([
      "Onboarding",
      "Prevent completion by members who signed their contracts before action",
      "Public Only",
      "For actions completed by non-members and not by members",
    ]);
    expect(leafTexts("Completion")).toEqual([
      "Complete After Deadline",
      "Show in tasks view after deadline passes",
      "Prevent Completion",
      "Prevents members from completing the action even on the detail page",
      "Optional",
      "Shows prominent dismiss dialog above task card",
    ]);
    expect(leafTexts("Custom stat")).toEqual([
      "Custom Stat Type",
      "Custom Stat Goal",
      "Custom Stat Label",
    ]);
    expect(options("Suite")).toEqual([["", "No suite"]]);
    expect(options("Visibility Mode")).toEqual([
      ["all_members", "All Members"],
      ["participating_groups", "Participating Groups"],
      ["public", "Public"],
    ]);
    expect(options("Custom Stat Type")).toEqual([
      ["none", "None"],
      ["users_invited", "Users Invited"],
    ]);
  });
});
