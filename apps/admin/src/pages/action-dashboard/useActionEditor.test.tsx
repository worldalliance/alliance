import { makeProfile } from "@alliance/shared/lib/testFixtures";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import { LeaveGuardRouter } from "../../lib/testing/LeaveGuardRouter";
import { makeParsedAction } from "../../lib/testing/parsedAction";
import { ToastProvider } from "../../ui/ToastProvider";
import { type ActionEditorState, useActionEditor } from "./useActionEditor";

const action = makeParsedAction({ shortDescription: "Short", body: "Body" });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LeaveGuardRouter>
    <ToastProvider>{children}</ToastProvider>
  </LeaveGuardRouter>
);

const noSearchParams = new URLSearchParams();
const setError = jest.fn();

const renderEditor = (
  overrides: Partial<ParsedActionDto> = {},
  {
    isNew = false,
    suites = [],
  }: {
    isNew?: boolean;
    suites?: { id: number; isPartitioned: boolean }[] | null;
  } = {},
) => {
  const updateAction = jest.fn(async () => action);
  let editor!: ActionEditorState;
  const Harness = () => {
    editor = useActionEditor({
      admin: {
        action: isNew ? null : { ...action, ...overrides },
        isFetching: false,
        createAction: jest.fn(),
        updateAction,
      },
      actionId: isNew ? null : action.id,
      isNew,
      cohortParseFailed: false,
      lookups: {
        availableSuites: suites ?? undefined,
        suitesLoading: suites === null,
        suitesError: false,
      },
      searchParams: noSearchParams,
      setError,
    });
    return editor.contentDialog;
  };
  render(<Harness />, { wrapper });
  return {
    result: {
      get current() {
        return editor;
      },
    },
    updateAction,
  };
};

const allMembers = { type: "AllMembers" } as const;

const otherAction = makeParsedAction({ id: 8, name: "Other" });

/** The editor on action 7, then on the action `rerenderFor` names, shown once loaded. */
const renderSwitchingEditor = (
  updateAction: () => Promise<ParsedActionDto> = async () => action,
) => {
  let editor!: ActionEditorState;
  const Harness = ({
    actionId,
    shown,
  }: {
    actionId: number;
    shown: ParsedActionDto | null;
  }) => {
    editor = useActionEditor({
      admin: {
        action: shown,
        isFetching: shown === null,
        createAction: jest.fn(),
        updateAction,
      },
      actionId,
      isNew: false,
      cohortParseFailed: false,
      lookups: {
        availableSuites: [],
        suitesLoading: false,
        suitesError: false,
      },
      searchParams: noSearchParams,
      setError,
    });
    return editor.contentDialog;
  };
  const { rerender } = render(<Harness actionId={action.id} shown={action} />, {
    wrapper,
  });
  return {
    result: {
      get current() {
        return editor;
      },
    },
    rerenderFor: (actionId: number, shown: ParsedActionDto | null = null) =>
      rerender(<Harness actionId={actionId} shown={shown} />),
  };
};

// handleSubmit only calls preventDefault on the event.
const submitEvent = { preventDefault: () => {} } as React.FormEvent;

const moveTo = (editor: ActionEditorState, suiteId: string) => {
  const suite = document.createElement("input");
  suite.name = "suiteId";
  suite.value = suiteId;
  // handleInputChange reads only the event's target.
  act(() =>
    editor.handleInputChange({
      target: suite,
    } as React.ChangeEvent<HTMLInputElement>),
  );
};

describe("useActionEditor", () => {
  it("is dirty after an edit and clean again once it saves", async () => {
    const { result } = renderEditor();
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));
    expect(result.current.dirty).toBe(false);

    act(() => result.current.handleCohortExpressionChange(allMembers));
    expect(result.current.dirty).toBe(true);

    await act(() => result.current.handleSubmit(submitEvent));
    expect(result.current.dirty).toBe(false);
    expect(screen.getByText(`Saved "${action.name}"`)).toBeTruthy();
  });

  it("asks for a name instead of saving a blank one", async () => {
    const { result, updateAction } = renderEditor({ name: "   " });
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));

    await act(() => result.current.handleSubmit(submitEvent));

    expect(setError).toHaveBeenLastCalledWith("Give the action a name.");
    expect(updateAction).not.toHaveBeenCalled();

    act(() =>
      result.current.handleInputChange({
        target: { name: "name", value: "Call your rep", type: "text" },
      } as React.ChangeEvent<HTMLInputElement>),
    );
    const clear = setError.mock.lastCall?.[0];
    expect(clear("Give the action a name.")).toBeNull();
    expect(clear("Failed to archive action")).toBe("Failed to archive action");
  });

  it("is dirty once a new action has an edit", async () => {
    const { result } = renderEditor({}, { isNew: true });
    await waitFor(() => expect(result.current.dirty).toBe(false));

    act(() => result.current.handleCohortExpressionChange(allMembers));

    expect(result.current.dirty).toBe(true);
  });

  it("keeps staff preview on when the details form saves afterwards", async () => {
    const { result, updateAction } = renderEditor();
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));

    await act(() => result.current.setStaffPreview(true));
    expect(updateAction).toHaveBeenLastCalledWith({ staffPreview: true });
    expect(result.current.dirty).toBe(false);

    act(() => result.current.handleCohortExpressionChange(allMembers));
    await act(() => result.current.handleSubmit(submitEvent));
    expect(updateAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        staffPreview: true,
        cohortExpression: allMembers,
      }),
    );
  });

  it.each([
    ["a partitioned suite action's save", [{ id: 3, isPartitioned: true }]],
    ["the save of an action whose suite's kind is unknown", null],
  ])(
    "leaves the optional flag, which the grid sets, out of %s",
    async (_, suites) => {
      const { result, updateAction } = renderEditor({}, { suites });
      await waitFor(() => expect(result.current.draftSeeded).toBe(true));

      moveTo(result.current, "3");
      await act(() => result.current.handleSubmit(submitEvent));
      expect(updateAction).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ optional: expect.anything() }),
      );
    },
  );

  it("keeps the optional flag the grid stored, so a move out of the suite sends it", async () => {
    const { result, updateAction } = renderEditor(
      { optional: false },
      {
        suites: [
          { id: 3, isPartitioned: true },
          { id: 4, isPartitioned: false },
        ],
      },
    );
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));

    moveTo(result.current, "3");
    updateAction.mockResolvedValueOnce({ ...action, optional: true });
    await act(() => result.current.handleSubmit(submitEvent));
    expect(result.current.dirty).toBe(false);
    moveTo(result.current, "4");
    await act(() => result.current.handleSubmit(submitEvent));
    expect(updateAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ optional: true }),
    );
  });

  it("leaves the slug, which saves inline, out of the details form's save", async () => {
    const { result, updateAction } = renderEditor();
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));

    act(() => result.current.handleCohortExpressionChange(allMembers));
    await act(() => result.current.handleSubmit(submitEvent));
    expect(updateAction).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ slug: expect.anything() }),
    );
  });

  it.each([
    ["Save anyway", 1],
    ["Cancel", 0],
  ])(
    "saves a body that mentions worldalliance on %s %i times",
    async (choice, saves) => {
      const { result, updateAction } = renderEditor({
        body: "[Settings](https://worldalliance.org/settings)",
      });
      await waitFor(() => expect(result.current.draftSeeded).toBe(true));

      let submitted!: Promise<void>;
      act(() => {
        submitted = result.current.handleSubmit(submitEvent);
      });
      fireEvent.click(await screen.findByRole("button", { name: choice }));
      await act(() => submitted);

      expect(updateAction).toHaveBeenCalledTimes(saves);
      if (saves) {
        expect(updateAction).toHaveBeenLastCalledWith(
          expect.objectContaining({
            body: "[Settings](https://worldalliance.org/settings)",
          }),
        );
      }
    },
  );

  it("asks before saving a body with an absolute site link", async () => {
    const { result, updateAction } = renderEditor({
      body: "[Act](https://thealliance.org/actions/53)",
    });
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));

    let submitted!: Promise<void>;
    act(() => {
      submitted = result.current.handleSubmit(submitEvent);
    });
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "Links to the site should be paths",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(() => submitted);

    expect(updateAction).not.toHaveBeenCalled();
  });

  it("saves a reviewer link, thumbnail or plain-text field on the site without asking", async () => {
    const { result, updateAction } = renderEditor({
      reviewers: [{ name: "Staff", url: "https://thealliance.org/people" }],
    });
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));
    for (const [name, value] of [
      ["squareThumbnailImage", "https://thealliance.org/thumbnail"],
      ["shortDescription", "Details at https://thealliance.org/faq"],
    ]) {
      // handleInputChange reads only the event's target.
      act(() =>
        result.current.handleInputChange({
          target: { name, value, type: "text" },
        } as React.ChangeEvent<HTMLInputElement>),
      );
    }

    await act(() => result.current.handleSubmit(submitEvent));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(updateAction).toHaveBeenCalled();
  });

  it("saves without asking when only an author's bio mentions worldalliance", async () => {
    const { result, updateAction } = renderEditor({
      authors: [
        {
          ...makeProfile(1),
          profileDescription: "Formerly at worldalliance.org",
        },
      ],
    });
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));

    await act(() => result.current.handleSubmit(submitEvent));

    expect(screen.queryByRole("button", { name: "Save anyway" })).toBeNull();
    expect(updateAction).toHaveBeenCalled();
  });

  it("is clean once the page moves to another action, until that one is seeded", async () => {
    const { result, rerenderFor } = renderSwitchingEditor();
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));
    act(() => result.current.handleCohortExpressionChange(allMembers));
    expect(result.current.dirty).toBe(true);

    rerenderFor(8);

    expect(result.current.dirty).toBe(false);
  });

  it("leaves the next action's draft clean when the previous action's save resolves late", async () => {
    let finishSave!: (saved: ParsedActionDto) => void;
    const { result, rerenderFor } = renderSwitchingEditor(
      () => new Promise((resolve) => (finishSave = resolve)),
    );
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));
    act(() => result.current.handleCohortExpressionChange(allMembers));
    let saved!: Promise<void>;
    act(() => {
      saved = result.current.handleSubmit(submitEvent);
    });
    await waitFor(() => expect(finishSave).toBeDefined());

    rerenderFor(8, otherAction);
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));
    await act(async () => {
      finishSave(action);
      await saved;
    });

    expect(result.current.dirty).toBe(false);
    expect(screen.getByText(`Saved "${action.name}"`)).toBeTruthy();
  });

  it.each([
    ["form", (editor: ActionEditorState) => editor.setTaskFormId(99)],
    [
      "staff preview",
      (editor: ActionEditorState) => editor.setStaffPreview(true),
    ],
  ])(
    "leaves the next action alone when the previous action's %s saves late",
    async (_, save) => {
      let finishSave!: (saved: ParsedActionDto) => void;
      const { result, rerenderFor } = renderSwitchingEditor(
        () => new Promise((resolve) => (finishSave = resolve)),
      );
      await waitFor(() => expect(result.current.draftSeeded).toBe(true));
      let saved!: Promise<void>;
      act(() => {
        saved = save(result.current);
      });
      await waitFor(() => expect(finishSave).toBeDefined());

      rerenderFor(8, otherAction);
      await waitFor(() => expect(result.current.draftSeeded).toBe(true));
      await act(async () => {
        finishSave(action);
        await saved;
      });

      expect(result.current.dirty).toBe(false);
      expect(result.current.form.staffPreview).toBe(false);
    },
  );

  it("is clean after a new action's only prerequisite is added and removed", async () => {
    const { result } = renderEditor({}, { isNew: true });
    await waitFor(() => expect(result.current.dirty).toBe(false));

    act(() => result.current.handlePrerequisitesChange([3]));
    act(() => result.current.handlePrerequisitesChange([]));

    expect(result.current.dirty).toBe(false);
  });

  it("is clean once an action with no form saves its first one", async () => {
    const { result } = renderEditor({ taskFormId: null });
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));

    await act(() => result.current.setTaskFormId(42));

    expect(result.current.dirty).toBe(false);
  });

  it("is clean once an action with no suite is set back to no suite", async () => {
    const { result } = renderEditor();
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));
    const setSuite = (value: string) =>
      act(() =>
        result.current.handleInputChange({
          target: { name: "suiteId", value, type: "select-one" },
        } as React.ChangeEvent<HTMLSelectElement>),
      );

    setSuite("3");
    expect(result.current.dirty).toBe(true);
    setSuite("");

    expect(result.current.dirty).toBe(false);
  });

  it("is clean once a new action's square thumbnail is cleared", async () => {
    const { result } = renderEditor({}, { isNew: true });
    await waitFor(() => expect(result.current.dirty).toBe(false));
    const setThumbnail = (value: string) =>
      act(() =>
        result.current.handleInputChange({
          target: { name: "squareThumbnailImage", value, type: "text" },
        } as React.ChangeEvent<HTMLInputElement>),
      );

    setThumbnail("https://example.com/a.png");
    expect(result.current.dirty).toBe(true);
    setThumbnail("");

    expect(result.current.dirty).toBe(false);
  });
});
