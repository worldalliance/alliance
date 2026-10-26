import type { CreateActionDto } from "@alliance/shared/client";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createActionForm } from "../lib/testing/createActionForm";
import ActionForm from "./ActionForm";

const baseForm = createActionForm({
  body: "Intro",
  optional: true,
  customStatType: "users_invited",
  timeEstimate: 10,
});

type ActionFormProps = React.ComponentProps<typeof ActionForm>;

const renderForm = (
  params: {
    form?: Partial<CreateActionDto>;
    props?: Partial<ActionFormProps>;
  } = {},
) => {
  const edits: [string, string | boolean][] = [];
  const onInputChange = jest.fn(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const { target } = e;
      edits.push([
        target.name,
        target instanceof HTMLInputElement && target.type === "checkbox"
          ? target.checked
          : target.value,
      ]);
    },
  );
  const onImageChange = jest.fn();
  const onCategoryChange = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <ActionForm
          form={{ ...baseForm, ...params.form }}
          onInputChange={onInputChange}
          onImageChange={onImageChange}
          onSubmit={jest.fn()}
          saving={false}
          imagePreview={null}
          onCancelImageUpload={jest.fn()}
          isNew={true}
          tagsLoading={false}
          tagsError={false}
          suitesLoading={false}
          suitesError={false}
          usersLoading={false}
          usersError={false}
          cohortExpression={null}
          onCohortExpressionChange={jest.fn()}
          onPrerequisitesChange={jest.fn()}
          authorIds={[]}
          onAuthorsChange={jest.fn()}
          onCategoryChange={onCategoryChange}
          reviewers={[]}
          onReviewersChange={jest.fn()}
          allActionsLoadFailed={false}
          memberActionStart={null}
          memberActionDeadline={null}
          {...params.props}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { edits, onImageChange, onCategoryChange };
};

const section = (title: string) => {
  const heading = screen.getByRole("heading", { name: title });
  const container = heading.parentElement?.parentElement;
  if (!container) throw new Error(`no section for ${title}`);
  return container;
};

const fieldNames = (title: string) =>
  Array.from(section(title).querySelectorAll("[name]"), (el) =>
    el.getAttribute("name"),
  );

const fieldKinds = (title: string) =>
  Array.from(section(title).querySelectorAll("[name]"), (el) =>
    el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
  );

const gridNames = (title: string) =>
  Array.from(section(title).querySelectorAll(".grid"), (grid) =>
    Array.from(grid.querySelectorAll("[name]"), (el) =>
      el.getAttribute("name"),
    ),
  ).filter((names) => names.length > 0);

const leafTexts = (title: string) =>
  Array.from(section(title).querySelectorAll("label, p, span"))
    .filter((el) => el.childElementCount === 0)
    .map((el) => el.textContent);

const options = (name: string) =>
  Array.from(
    screen.getByRole<HTMLSelectElement>("combobox", { name }).options,
    (option) => [option.value, option.textContent],
  );

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
      "timeEstimate",
      "customStatType",
      "customStatGoal",
      "customStatLabel",
      "onboarding",
      "staffPreview",
      "shouldCompleteAfterDeadline",
      "preventCompletion",
      "publicOnly",
      "optional",
      "isForumParticipationAction",
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
      "number",
      "select",
      "number",
      "text",
      ...Array(7).fill("checkbox"),
    ]);

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
      [
        "suiteId",
        "visibilityMode",
        "timeEstimate",
        "customStatType",
        "customStatGoal",
        "customStatLabel",
      ],
      [
        "onboarding",
        "staffPreview",
        "shouldCompleteAfterDeadline",
        "preventCompletion",
        "publicOnly",
        "optional",
        "isForumParticipationAction",
      ],
    ]);

    const content = within(section("Content"));
    expect(content.getByText("Action Authors")).toBeTruthy();
    expect(content.getByText("Reviewed By")).toBeTruthy();
    expect(within(section("Settings")).getByText("Category")).toBeTruthy();
  });

  it("hides the custom stat fields without a stat type and shows the forum override on forum participation actions", () => {
    renderForm({
      form: { customStatType: "none", isForumParticipationAction: true },
    });

    expect(fieldNames("Settings")).toEqual([
      "suiteId",
      "visibilityMode",
      "timeEstimate",
      "customStatType",
      "forumParticipationPostId",
      "onboarding",
      "staffPreview",
      "shouldCompleteAfterDeadline",
      "preventCompletion",
      "publicOnly",
      "optional",
      "isForumParticipationAction",
      "forumParticipationIncludeChildren",
    ]);
    expect(fieldKinds("Settings")).toEqual([
      "select",
      "select",
      "number",
      "select",
      "number",
      ...Array(8).fill("checkbox"),
    ]);
    expect(leafTexts("Settings")).toEqual(
      expect.arrayContaining([
        "Forum Post ID (override)",
        "Autocomplete based on replies to this post, ignoring any forum validator on the form. Leave blank to use the form's validator.",
        "Include child replies",
        "Also count replies to nested child posts of the override post",
      ]),
    );
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
      "Time Estimate (min)",
      "Custom Stat Type",
      "Custom Stat Goal",
      "Custom Stat Label",
      "Onboarding",
      "Prevent completion by members who signed their contracts before action",
      "Staff Preview",
      "Staff see it on their home pages until the Member Action event starts, or indefinitely if none is scheduled. Until then, nobody can submit, complete, withdraw, dismiss, like, or comment.",
      "Complete After Deadline",
      "Show in tasks view after deadline passes",
      "Prevent Completion",
      "Prevents members from completing the action even on the detail page",
      "Public Only",
      "For actions completed by non-members and not by members",
      "Optional",
      "Shows prominent dismiss dialog above task card",
      "Forum Participation Action",
      "Autocomplete action for users who leave comment but dont hit complete",
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

  it("shows the stored values and forwards edits", () => {
    const { edits, onImageChange, onCategoryChange } = renderForm();

    const value = (label: string | RegExp) =>
      screen.getByLabelText<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >(label).value;
    const checked = (label: RegExp) =>
      screen.getByLabelText<HTMLInputElement>(label).checked;
    expect(value("Name")).toBe("Call your rep");
    expect(value("Action page description")).toBe("Intro");
    expect(value("Visibility Mode")).toBe("all_members");
    expect(value("Time Estimate (min)")).toBe("10");
    expect(checked(/^Optional/)).toBe(true);
    expect(checked(/^Public Only/)).toBe(false);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Write your rep" },
    });
    fireEvent.change(screen.getByLabelText("Action page description"), {
      target: { value: "Hi" },
    });
    fireEvent.change(screen.getByLabelText("Visibility Mode"), {
      target: { value: "public" },
    });
    fireEvent.change(screen.getByLabelText("Time Estimate (min)"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Custom Stat Label"), {
      target: { value: "Invites" },
    });
    fireEvent.click(screen.getByLabelText(/^Public Only/));
    fireEvent.click(screen.getByLabelText(/^Optional/));
    expect(edits).toEqual([
      ["name", "Write your rep"],
      ["body", "Hi"],
      ["visibilityMode", "public"],
      ["timeEstimate", "5"],
      ["customStatLabel", "Invites"],
      ["publicOnly", true],
      ["optional", false],
    ]);

    fireEvent.paste(screen.getByLabelText("Action page description"), {
      clipboardData: {
        getData: (type: string) => (type === "text/html" ? "<b>Hi</b>" : ""),
      },
    });
    expect(edits.at(-1)).toEqual(["body", "Intro**Hi**"]);

    fireEvent.change(screen.getByLabelText("Cover image"), {
      target: { files: [new File(["x"], "cover.png", { type: "image/png" })] },
    });
    expect(onImageChange).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Environmental destruction" }),
    );
    expect(onCategoryChange).toHaveBeenCalledWith(["environment"]);
  });

  it("offers the available suites and shows the stored one", () => {
    renderForm({
      form: { suiteId: 3 },
      props: {
        availableSuites: [
          {
            id: 3,
            name: "Climate",
            actions: [],
            events: [],
            reminderGroups: [],
            generalUpdates: [],
          },
        ],
      },
    });

    expect(options("Suite")).toEqual([
      ["", "No suite"],
      ["3", "Climate"],
    ]);
    expect(screen.getByLabelText<HTMLSelectElement>("Suite").value).toBe("3");
  });

  it("shows the stored categories", () => {
    renderForm({ form: { category: ["poverty"] } });

    expect(
      screen
        .getByRole("button", { name: "Extreme poverty" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Environmental destruction" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("shows suite loading and the cover image's upload, error, and preview", () => {
    const onCancelImageUpload = jest.fn();
    renderForm({
      form: { image: "cover.png" },
      props: {
        isNew: false,
        baseUrl: "https://api.example",
        onCancelImageUpload,
        suitesLoading: true,
        imageUploading: true,
        imageError: "Too big",
        imagePreview: "blob:preview",
      },
    });

    expect(screen.getByText("Fetching suites...")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Cancel the upload and keep the current image",
      }),
    );
    expect(onCancelImageUpload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Too big")).toBeTruthy();
    expect(screen.getByAltText<HTMLImageElement>("Preview").src).toBe(
      "blob:preview",
    );
    expect(screen.queryByAltText("Current")).toBeNull();
  });

  it("shows the current cover image when editing", () => {
    renderForm({
      form: { image: "cover.png" },
      props: { isNew: false, baseUrl: "https://api.example" },
    });

    expect(screen.getByAltText<HTMLImageElement>("Current").src).toBe(
      "https://api.example/images/cover.png",
    );
  });

  it("shows no current cover image on a new action", () => {
    renderForm({
      form: { image: "cover.png" },
      props: { baseUrl: "https://api.example" },
    });

    expect(screen.queryByAltText("Current")).toBeNull();
  });
});
