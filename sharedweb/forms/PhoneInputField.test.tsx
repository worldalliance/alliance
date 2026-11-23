import type { PhoneField } from "@alliance/common/forms/form-schema";
import { cleanup, render, screen } from "@testing-library/react";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { PhoneInputField } from "./PhoneInputField";
import { PhoneConfirmSlot } from "./phoneConfirmSlot";

const profileField: PhoneField = {
  id: "phone",
  type: "input",
  kind: "phone",
  label: "Phone",
  autoExtractUserData: true,
};

const renderField = (params: {
  field?: PhoneField;
  value: string;
  slot?: boolean;
  onChange?: () => void;
  disabled?: boolean;
}) =>
  render(
    <SiteAppProvider>
      <PhoneConfirmSlot.Provider
        value={
          params.slot === false ? null : (number) => <p>Confirm {number}</p>
        }
      >
        <PhoneInputField
          field={params.field ?? profileField}
          value={params.value}
          onChange={"onChange" in params ? params.onChange : () => {}}
          disabled={params.disabled}
          errorMessage={null}
          required={false}
        />
      </PhoneConfirmSlot.Provider>
    </SiteAppProvider>,
  );

// Each render below then shows the lazy phone input rather than its empty fallback.
beforeAll(async () => {
  renderField({ value: "" });
  await screen.findByRole("textbox", {}, { timeout: 4000 });
  cleanup();
});

it("offers to confirm a whole number on a question that fills the profile", async () => {
  renderField({ value: "+14155552671" });
  expect(await screen.findByText("Confirm +14155552671")).toBeTruthy();
});

it.each([
  ["a number not yet whole", { value: "+1415" }],
  [
    "a question that leaves the profile alone",
    {
      value: "+14155552671",
      field: { ...profileField, autoExtractUserData: false },
    },
  ],
  ["a form that provides no confirm", { value: "+14155552671", slot: false }],
  [
    "an answer that can't change",
    { value: "+14155552671", onChange: undefined },
  ],
  ["a disabled field", { value: "+14155552671", disabled: true }],
])("offers nothing for %s", async (_, params) => {
  renderField(params);
  await screen.findByRole("textbox");
  expect(screen.queryByText(/^Confirm/)).toBeNull();
});
