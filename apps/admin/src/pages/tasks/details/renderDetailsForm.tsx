import type { CreateActionDto } from "@alliance/shared/client";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { createActionForm } from "../../../lib/testing/createActionForm";
import { ToastProvider } from "../../../ui/ToastProvider";
import type { TaskLookups } from "../taskTabs";
import type { DetailsEditor } from "./detailsRules";
import { TaskDetailsForm } from "./TaskDetailsForm";

const baseForm = createActionForm({
  body: "Intro",
  optional: true,
  customStatType: "users_invited",
  timeEstimate: 10,
});

export const testLookups = (
  overrides: Partial<TaskLookups> = {},
): TaskLookups => ({
  availableTags: [],
  tagsLoading: false,
  tagsError: false,
  availableSuites: [],
  suitesLoading: false,
  suitesError: false,
  availableUsers: [],
  usersLoading: false,
  usersError: false,
  activeContractUserIds: new Set(),
  allActions: [],
  allActionsLoading: false,
  allActionsLoadFailed: false,
  ...overrides,
});

type RenderParams = {
  form?: Partial<CreateActionDto>;
  editor?: Partial<DetailsEditor>;
  lookups?: Partial<TaskLookups>;
  /** The saved task; null renders the create form. */
  task?: ParsedActionDto | null;
  hideStaffPreview?: boolean;
  cohortParseFailed?: boolean;
};

/** Renders the Details form over a stand-in draft that records each edit as `[field, value]`. */
export const renderForm = (params: RenderParams = {}) => {
  const edits: [string, unknown][] = [];
  const form = { ...baseForm, ...params.form };
  const editor = (overrides?: Partial<DetailsEditor>): DetailsEditor => ({
    form,
    dirty: false,
    justSaved: false,
    saveError: null,
    nameMissing: false,
    discard: jest.fn(),
    patchForm: (patch) => edits.push(...Object.entries(patch)),
    handleInputChange: ({ target }) =>
      edits.push([
        target.name,
        target instanceof HTMLInputElement && target.type === "checkbox"
          ? target.checked
          : target.value,
      ]),
    handleSubmit: jest.fn(async () => {}),
    handleCohortExpressionChange: jest.fn(),
    handlePrerequisitesChange: jest.fn(),
    handleAuthorsChange: jest.fn(),
    handleCategoryChange: jest.fn(),
    pickCoverImage: jest.fn(async () => {}),
    cancelCoverImage: jest.fn(),
    imagePreview: null,
    imageError: null,
    imageUploading: false,
    cohortExpression: null,
    reviewerRows: [],
    setReviewerRows: jest.fn(),
    contentDialog: <></>,
    ...params.editor,
    ...overrides,
  });
  const client = new QueryClient();
  const ui = (current: DetailsEditor) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <TaskDetailsForm
            editor={current}
            lookups={testLookups(params.lookups)}
            task={params.task ?? null}
            saving={false}
            hideStaffPreview={params.hideStaffPreview}
            cohortParseFailed={params.cohortParseFailed}
          />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  const first = editor();
  const { rerender } = render(ui(first));
  return {
    edits,
    editor: first,
    rerender: (overrides: Partial<DetailsEditor>) =>
      rerender(ui(editor(overrides))),
  };
};

/** The body of the form section, or setting group, with this title. */
export const section = (title: string) => {
  const heading = screen.getByRole("heading", { name: title });
  const toggle = heading.querySelector("button[aria-controls]");
  const container = toggle
    ? document.getElementById(toggle.getAttribute("aria-controls") ?? "")
    : heading.closest("section");
  if (!container) throw new Error(`no section for ${title}`);
  return container;
};

export const fieldNames = (title: string) =>
  Array.from(section(title).querySelectorAll("[name]"), (el) =>
    el.getAttribute("name"),
  );

export const fieldKinds = (title: string) =>
  Array.from(section(title).querySelectorAll("[name]"), (el) =>
    el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
  );

export const options = (name: string) =>
  Array.from(
    screen.getByRole<HTMLSelectElement>("combobox", { name }).options,
    (option) => [option.value, option.textContent],
  );
