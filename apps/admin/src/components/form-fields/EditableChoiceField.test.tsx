import {
  anyFieldSchema,
  type MultiSelectField,
} from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { CustomValidatorDraftsContext } from "./customValidatorDrafts";
import { EditableChoiceField } from "./EditableChoiceField";

afterEach(cleanup);
serveApi(routes({}));

const initial: MultiSelectField = {
  id: "places",
  type: "input",
  kind: "multiselect",
  label: "Places",
  required: true,
  randomizeOptions: true,
  maxSelections: 2,
  defaultValue: ["ny"],
  options: [
    { label: "New York", value: "ny" },
    { label: "California", value: "ca" },
  ],
};

let latest: MultiSelectField = initial;

function Editor() {
  const [field, setField] = useState(initial);
  latest = field;
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <CustomValidatorDraftsContext.Provider
            value={{
              drafts: {},
              setDraft() {},
              removeDraft() {},
              createDraftId: () => -1,
            }}
          >
            <EditableChoiceField
              field={field}
              onUpdate={(updates) =>
                setField((prev) => ({
                  ...prev,
                  ...updates,
                  kind: "multiselect",
                }))
              }
              onRemove={() => {}}
            />
          </CustomValidatorDraftsContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const display = () => screen.getByRole("combobox", { name: "Display" });
const reloaded = () => {
  const field = anyFieldSchema.parse(JSON.parse(JSON.stringify(latest)));
  if (field.kind !== "multiselect") throw new Error(`kind: ${field.kind}`);
  return field;
};

it("defaults to checkboxes and sets both flags for each display", () => {
  render(<Editor />);
  expect((display() as HTMLSelectElement).value).toBe("checkboxes");

  fireEvent.change(display(), { target: { value: "dropdown" } });
  expect(reloaded()).toMatchObject({ dropdown: true });
  expect(reloaded()).not.toHaveProperty("searchable");

  fireEvent.change(display(), { target: { value: "searchable-dropdown" } });
  expect(reloaded()).toMatchObject({ dropdown: true, searchable: true });

  fireEvent.change(display(), { target: { value: "checkboxes" } });
  expect(reloaded()).not.toHaveProperty("dropdown");
  expect(reloaded()).not.toHaveProperty("searchable");
});

it("keeps the field's other settings when switching displays", () => {
  render(<Editor />);
  fireEvent.change(display(), { target: { value: "searchable-dropdown" } });
  fireEvent.change(display(), { target: { value: "dropdown" } });
  const { dropdown: _dropdown, ...rest } = reloaded();
  expect(rest).toEqual(initial);
  expect((display() as HTMLSelectElement).value).toBe("dropdown");
});
