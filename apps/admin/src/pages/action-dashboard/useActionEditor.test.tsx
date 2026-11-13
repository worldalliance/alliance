import { makeAction, makeProfile } from "@alliance/shared/lib/testFixtures";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router";
import { type ActionEditorState, useActionEditor } from "./useActionEditor";

const action: ParsedActionDto = {
  ...makeAction({ id: 7, shortDescription: "Short", body: "Body" }),
  slug: "seven",
  followUpForms: [],
  staffPreview: false,
  prerequisiteActionIds: [],
  memberActionStart: null,
  memberActionDeadline: null,
  storedImage: null,
  storedSquareThumbnailImage: null,
  cohortExpression: null,
};

const renderEditor = (overrides: Partial<ParsedActionDto> = {}) => {
  const updateAction = jest.fn(async () => action);
  let editor!: ActionEditorState;
  const Harness = () => {
    editor = useActionEditor({
      admin: {
        action: { ...action, ...overrides },
        isFetching: false,
        createAction: jest.fn(),
        updateAction,
      },
      actionId: action.id,
      isNew: false,
      cohortParseFailed: false,
      searchParams: new URLSearchParams(),
      setError: jest.fn(),
    });
    return editor.worldallianceDialog;
  };
  render(<Harness />, { wrapper: MemoryRouter });
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

// handleSubmit only calls preventDefault on the event.
const submitEvent = { preventDefault: () => {} } as React.FormEvent;

describe("useActionEditor", () => {
  it("is dirty after an edit and clean again once it saves", async () => {
    const { result } = renderEditor();
    await waitFor(() => expect(result.current.draftSeeded).toBe(true));
    expect(result.current.dirty).toBe(false);

    act(() => result.current.handleCohortExpressionChange(allMembers));
    expect(result.current.dirty).toBe(true);

    await act(() => result.current.handleSubmit(submitEvent));
    expect(result.current.dirty).toBe(false);
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
});
