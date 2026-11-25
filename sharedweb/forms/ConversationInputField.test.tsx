import type {
  ConversationField,
  FormValue,
} from "@alliance/common/forms/form-schema";
import {
  resolveFormValue,
  type FormValueUpdater,
} from "@alliance/shared/forms/formValueUpdater";
import { EXPERT_TYPING_MS } from "@alliance/shared/forms/useExpertTyping";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { ConversationInputField } from "./ConversationInputField";

const field: ConversationField = {
  id: "aware",
  type: "input",
  kind: "conversation",
  label: "Aware",
  expert: { userId: 7, userName: "Dr Maria" },
  message: "Were you aware of these statements?",
  options: [
    { label: "Yes, and I accept them", value: "accept" },
    {
      label: "Not convinced",
      value: "skeptic",
      reply: "Please leave a note about your skepticism",
      note: { placeholder: "Your skepticism" },
    },
  ],
  noteId: "aware_note",
};

function Harness({ initial }: { initial?: string }) {
  const [value, setValue] = useState<FormValue | undefined>(initial);
  const [note, setNote] = useState<FormValue | undefined>();
  const update =
    (set: typeof setValue, previous: FormValue | undefined) =>
    (next: FormValueUpdater) =>
      set(resolveFormValue(next, previous));
  return (
    <MemoryRouter>
      <SiteAppProvider>
        <ConversationInputField
          field={field}
          value={value}
          onChange={update(setValue, value)}
          noteValue={note}
          onNoteChange={update(setNote, note)}
          errorMessage={null}
          required={false}
        />
      </SiteAppProvider>
    </MemoryRouter>
  );
}

describe("ConversationInputField", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("names the options' group by the expert's message", () => {
    render(<Harness />);
    expect(
      screen.getByRole("radiogroup", {
        name: "Were you aware of these statements?",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Dr Maria")).toBeTruthy();
  });

  it("types, then replies and offers the note box, after a pick", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "Not convinced" }));
    expect(
      screen.getByRole("status", { name: "Dr Maria is typing" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Your note (optional)")).toBeNull();

    act(() => jest.advanceTimersByTime(EXPERT_TYPING_MS));
    expect(
      screen.getByText("Please leave a note about your skepticism"),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your note (optional)"), {
      target: { value: "I doubt it" },
    });
    expect(screen.getByDisplayValue("I doubt it")).toBeTruthy();
  });

  it("shows a saved choice's reply straight away", () => {
    render(<Harness initial="skeptic" />);
    expect(
      screen.getByText("Please leave a note about your skepticism"),
    ).toBeTruthy();
  });

  it("keeps every option visible after a pick, so it can change", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "Not convinced" }));
    fireEvent.click(
      screen.getByRole("radio", { name: "Yes, and I accept them" }),
    );
    act(() => jest.advanceTimersByTime(EXPERT_TYPING_MS));
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(
      screen.queryByText("Please leave a note about your skepticism"),
    ).toBeNull();
  });
});
