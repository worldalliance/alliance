import { makeAction } from "@alliance/shared/lib/testFixtures";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router";
import { useActionEditor } from "./useActionEditor";

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

const renderEditor = () => {
  const updateAction = jest.fn(async () => action);
  const { result } = renderHook(
    () =>
      useActionEditor({
        admin: {
          action,
          isFetching: false,
          createAction: jest.fn(),
          updateAction,
        },
        actionId: action.id,
        isNew: false,
        cohortParseFailed: false,
        searchParams: new URLSearchParams(),
        setError: jest.fn(),
      }),
    { wrapper: MemoryRouter },
  );
  return { result, updateAction };
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
});
