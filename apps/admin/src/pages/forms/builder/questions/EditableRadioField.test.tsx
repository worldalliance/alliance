import type { RadioField } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { EditorSidebar } from "../../../../lib/testing/EditorSidebar";
import { SiteAppProvider } from "../../../../ui/SiteAppProvider";
import { CustomValidatorDraftsContext } from "./customValidatorDrafts";
import { EditableRadioField } from "./EditableRadioField";

serveApi(routes({}));

const initial: RadioField = {
  id: "pet",
  type: "input",
  kind: "radio",
  label: "Pet",
  required: false,
  defaultValue: "cat",
  options: [
    { label: "Dog", value: "dog" },
    { label: "Cat", value: "cat" },
  ],
};

let latest: RadioField = initial;

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
            <EditorSidebar>
              <EditableRadioField
                field={field}
                onUpdate={(updates) =>
                  setField((prev) => ({ ...prev, ...updates }))
                }
              />
            </EditorSidebar>
          </CustomValidatorDraftsContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const fromRowMenu = async (subject: string, item: string) => {
  fireEvent.click(screen.getByRole("button", { name: `More: ${subject}` }));
  const menu = await screen.findByRole("menu");
  fireEvent.click(within(menu).getByRole("menuitem", { name: item }));
};

it("moves an option up, keeping the default on it", async () => {
  render(<Editor />);
  await fromRowMenu("Option Cat", "Move up");
  expect(latest.options.map((option) => option.value)).toEqual(["cat", "dog"]);
  expect(latest.defaultValue).toBe("cat");
  const [first] = within(
    screen.getByRole("list", { name: "Options" }),
  ).getAllByRole("radio");
  expect((first as HTMLInputElement).checked).toBe(true);
});

it("carries the default to an option's new value and clears it on removal", async () => {
  render(<Editor />);
  fireEvent.change(screen.getByDisplayValue("cat"), {
    target: { value: "kitten" },
  });
  expect(latest.defaultValue).toBe("kitten");
  await fromRowMenu("Option Cat", "Remove option");
  expect(latest.defaultValue).toBeNull();
  expect(latest.options).toEqual([{ label: "Dog", value: "dog" }]);
});
