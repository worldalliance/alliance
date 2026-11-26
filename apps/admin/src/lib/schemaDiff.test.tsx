import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import { SchemaDiffView } from "./schemaDiff";

const formWith = (fields: unknown[]) => ({ pages: [{ id: "p1", fields }] });

describe("SchemaDiffView", () => {
  it("names an added block by its text, as blocks have no label", () => {
    render(
      <SchemaDiffView
        before={formWith([])}
        after={formWith([
          { id: "h1", type: "display", kind: "header", text: "Background" },
          { id: "s1", type: "display", kind: "spacer" },
        ])}
      />,
    );
    expect(screen.getByText("h1 · header · Background")).toBeTruthy();
    expect(screen.getByText("s1 · spacer · (no label)")).toBeTruthy();
  });
});
