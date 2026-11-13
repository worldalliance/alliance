import { makeAction } from "@alliance/shared/lib/testFixtures";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router";
import ActionEditor from "./ActionEditor";
import { useActionEditor } from "./useActionEditor";

const action: ParsedActionDto = {
  ...makeAction({
    id: 7,
    shortDescription: "Short",
    body: "[Settings](https://worldalliance.org/settings)",
  }),
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

const lookups = {
  tagsLoading: false,
  tagsError: false,
  suitesLoading: false,
  suitesError: false,
  usersLoading: false,
  usersError: false,
  allActionsLoadFailed: false,
};

const renderActionEditor = (isNew: boolean) => {
  const createAction = jest.fn(async () => action);
  const updateAction = jest.fn(async () => action);
  const searchParams = new URLSearchParams();
  const setError = jest.fn();
  const mode = isNew
    ? { isNew: true as const, onCancel: jest.fn() }
    : {
        isNew: false as const,
        cohortParseFailed: false,
        onDelete: jest.fn(),
        checklist: null,
      };
  const Harness = () => {
    const editor = useActionEditor({
      admin: {
        action: isNew ? null : action,
        isFetching: false,
        createAction,
        updateAction,
      },
      actionId: isNew ? null : action.id,
      isNew,
      cohortParseFailed: false,
      searchParams,
      setError,
    });
    return (
      <ActionEditor
        editor={editor}
        lookups={lookups}
        action={isNew ? null : action}
        saving={false}
        mode={mode}
      />
    );
  };
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
  render(<Harness />, { wrapper: Wrapper });
  return isNew ? createAction : updateAction;
};

it.each([
  ["a new action", true],
  ["an existing action", false],
])("shows the worldalliance dialog when saving %s", async (_, isNew) => {
  const save = renderActionEditor(isNew);
  if (isNew) {
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { name: "name", value: "worldalliance action" },
    });
  } else {
    await waitFor(() => expect(screen.getByDisplayValue("Short")).toBeTruthy());
  }

  fireEvent.click(
    screen.getByRole("button", {
      name: isNew ? "Create Action" : "Save Changes",
    }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Save anyway" }));

  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
});
