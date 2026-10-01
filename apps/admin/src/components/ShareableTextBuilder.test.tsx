import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { ShareableTextBuilder } from "./ShareableTextBuilder";

afterEach(cleanup);

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "town", type: "input", kind: "text", label: "Town" },
        { id: "topic", type: "input", kind: "text", label: "Topic" },
        { id: "mood", type: "input", kind: "text", label: "Tone" },
        { id: "q-42", type: "input", kind: "text", label: "Venue" },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

function Harness() {
  const [current, setCurrent] = useState(schema);
  return <ShareableTextBuilder schema={current} onSchemaChange={setCurrent} />;
}

const completedBox = () =>
  screen.getByPlaceholderText<HTMLTextAreaElement>(
    "Example: I have #{field-123} things!",
  );
const defaultBox = () =>
  screen.getByPlaceholderText<HTMLTextAreaElement>(
    "Example: Join me in taking this action.",
  );
const [completedFirstName, defaultFirstName] = [0, 1].map(
  (index) => () =>
    screen.getAllByRole("button", { name: /#\{first-name\}/ })[index],
);

const topicSuggestion = () =>
  screen.getByRole("button", { name: /Topic.*text$/ });

function drag(from: HTMLElement, to: HTMLElement) {
  const data = new Map<string, string>();
  const dataTransfer = {
    setData: (key: string, value: string) => data.set(key, value),
    getData: (key: string) => data.get(key) ?? "",
  };
  fireEvent.dragStart(from, { dataTransfer });
  expect(fireEvent.dragOver(to, { dataTransfer })).toBe(false);
  expect(fireEvent.drop(to, { dataTransfer })).toBe(false);
  return data;
}

describe("ShareableTextBuilder", () => {
  beforeEach(() => render(<Harness />));

  it("inserts a clicked form field's token into the completed text", () => {
    fireEvent.click(screen.getByRole("button", { name: /Town/ }));

    expect(completedBox().value).toBe("#{town}");
  });

  it("inserts a clicked member detail into the completed text", () => {
    fireEvent.click(completedFirstName());

    expect(completedBox().value).toBe("#{first-name}");
    expect(defaultBox().value).toBe("");
  });

  it("inserts a clicked member detail into the default text", () => {
    fireEvent.click(defaultFirstName());

    expect(defaultBox().value).toBe("#{first-name}");
    expect(completedBox().value).toBe("");
  });

  it.each([
    ["completed", completedBox, completedFirstName],
    ["default", defaultBox, defaultFirstName],
  ])(
    "inserts a clicked token at the %s text's caret",
    async (_, box, button) => {
      fireEvent.change(box(), { target: { value: "Hi !" } });
      box().setSelectionRange(3, 3);
      fireEvent.click(button());
      await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));

      expect(box().value).toBe("Hi #{first-name}!");
      expect(box().selectionStart).toBe("Hi #{first-name}".length);
    },
  );

  it("inserts a member detail dragged onto the completed text", () => {
    drag(completedFirstName(), completedBox());

    expect(completedBox().value).toBe("#{first-name}");
  });

  it("inserts a form field dragged onto the completed text", () => {
    const data = drag(
      screen.getByRole("button", { name: /Town/ }),
      completedBox(),
    );

    expect(completedBox().value).toBe("#{town}");
    expect(data.get("text/plain")).toBe("#{town}");
  });

  it("inserts a member detail dragged onto the default text", () => {
    drag(defaultFirstName(), defaultBox());

    expect(defaultBox().value).toBe("#{first-name}");
  });

  it("ignores a completed-text member detail dropped on the default text", () => {
    drag(completedFirstName(), defaultBox());

    expect(defaultBox().value).toBe("");
  });

  it.each([
    ["#{", "#{town}"],
    ["#{q-4", "#{q-42}"],
  ])("completes %s to its first suggestion", (typed, expected) => {
    fireEvent.change(completedBox(), { target: { value: typed } });
    fireEvent.keyUp(completedBox());
    fireEvent.keyDown(completedBox(), { key: "Enter" });

    expect(completedBox().value).toBe(expected);
  });

  it("moves the highlight back to the first suggestion as the query changes", () => {
    fireEvent.change(completedBox(), { target: { value: "#{t" } });
    fireEvent.keyUp(completedBox());
    fireEvent.keyDown(completedBox(), { key: "ArrowDown" });
    fireEvent.change(completedBox(), { target: { value: "#{to" } });
    fireEvent.keyUp(completedBox());
    fireEvent.keyDown(completedBox(), { key: "Enter" });

    expect(completedBox().value).toBe("#{town}");
  });

  describe("with a partly typed token", () => {
    beforeEach(() => {
      fireEvent.change(completedBox(), { target: { value: "Hi #{to!" } });
      completedBox().setSelectionRange(7, 7);
      fireEvent.keyUp(completedBox());
    });

    it.each(["Enter", "Tab"])("completes the first suggestion on %s", (key) => {
      fireEvent.keyDown(completedBox(), { key });

      expect(completedBox().value).toBe("Hi #{town}!");
    });

    it.each([
      ["ArrowDown", "Hi #{topic}!"],
      ["ArrowUp", "Hi #{mood}!"],
    ])("completes the suggestion %s moves to", (key, expected) => {
      fireEvent.keyDown(completedBox(), { key });
      fireEvent.keyDown(completedBox(), { key: "Enter" });

      expect(completedBox().value).toBe(expected);
    });

    it("completes a suggestion picked with the mouse", () => {
      fireEvent.mouseDown(topicSuggestion());

      expect(completedBox().value).toBe("Hi #{topic}!");
    });
  });

  it("strips form-field tokens from the default text", () => {
    fireEvent.change(defaultBox(), {
      target: { value: "Hi #{first-name} #{town}" },
    });

    expect(defaultBox().value).toBe("Hi #{first-name} ");
  });
});
