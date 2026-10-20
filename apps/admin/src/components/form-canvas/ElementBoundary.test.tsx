import type { PageItem } from "@alliance/common/forms/form-schema";
import { render, screen } from "@testing-library/react";
import { useContext } from "react";
import { OverrideTargetContext } from "../display-blocks/perUserContent";
import { ElementBoundary } from "./ElementBoundary";

const header = (text: string): PageItem => ({
  id: "h",
  type: "display",
  kind: "header",
  text,
});

function Shown({ element }: { element: PageItem }) {
  if (element.kind !== "header" || element.text === "") {
    throw new Error("no text");
  }
  return <p>{element.text}</p>;
}

const renderFor = (element: PageItem) => (
  <ElementBoundary
    element={element}
    fallback={(message) => <p>Flagged: {message}</p>}
  >
    {() => <Shown element={element} />}
  </ElementBoundary>
);

it("flags an element that throws, and tries again once it changes", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const broken = header("");
  const { rerender } = render(renderFor(broken));
  expect(screen.getByText("Flagged: no text")).toBeTruthy();

  rerender(renderFor(broken));
  expect(screen.getByText("Flagged: no text")).toBeTruthy();

  rerender(renderFor(header("Welcome")));
  expect(screen.getByText("Welcome")).toBeTruthy();
});

function ShownFor() {
  if (useContext(OverrideTargetContext)?.userId === "u1") {
    throw new Error("bad override");
  }
  return <p>Default</p>;
}

const welcome = header("Welcome");

const renderForUser = (userId: string | null) => (
  <OverrideTargetContext.Provider value={{ userId, select: () => {} }}>
    <ElementBoundary
      element={welcome}
      fallback={(message) => <p>Flagged: {message}</p>}
    >
      {() => <ShownFor />}
    </ElementBoundary>
  </OverrideTargetContext.Provider>
);

it("tries again once the user whose content it shows changes", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const { rerender } = render(renderForUser("u1"));
  expect(screen.getByText("Flagged: bad override")).toBeTruthy();

  rerender(renderForUser(null));
  expect(screen.getByText("Default")).toBeTruthy();
});
