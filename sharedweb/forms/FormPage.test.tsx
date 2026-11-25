import type { PageItem } from "@alliance/common/forms/form-schema";
import { render, screen } from "@testing-library/react";
import FormPage from "./FormPage";

const label = (id: string, group?: string): PageItem => ({
  id,
  type: "display",
  kind: "label",
  text: id,
  ...(group === undefined ? {} : { group }),
});

const renderPage = (elements: PageItem[], hidden: string[] = []) =>
  render(
    <div data-testid="page">
      <FormPage
        elements={elements}
        activeUserKey={undefined}
        isElementCurrentlyVisible={(element) =>
          !hidden.includes(element.id ?? "")
        }
        variableValues={new Map()}
        blockProps={{}}
        fieldRef={() => () => {}}
        renderField={(field) => field.id}
      />
    </div>,
  );

const boxOf = (text: string) => screen.getByText(text).closest(".bg-zinc-100");

it("draws one box around a group's consecutive members", () => {
  renderPage([label("a"), label("b", "g1"), label("c", "g1"), label("d")]);

  expect(boxOf("a")).toBeNull();
  expect(boxOf("b")).not.toBeNull();
  expect(boxOf("b")).toBe(boxOf("c"));
  expect(boxOf("d")).toBeNull();
});

it("draws back-to-back groups as separate boxes", () => {
  renderPage([label("a", "g1"), label("b", "g2")]);

  expect(boxOf("a")).not.toBe(boxOf("b"));
});

it("leaves out hidden members, and a box whose members are all hidden", () => {
  renderPage(
    [label("a", "g1"), label("b", "g1"), label("c", "g2")],
    ["a", "c"],
  );

  expect(screen.queryByText("a")).toBeNull();
  expect(boxOf("b")).not.toBeNull();
  expect(
    screen.getByTestId("page").querySelectorAll(".bg-zinc-100"),
  ).toHaveLength(1);
});
