import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { TableSkeleton } from "./States";

afterEach(cleanup);

describe("TableSkeleton", () => {
  it("sits a right-aligned column's bars at its right edge", () => {
    const { container } = render(
      <TableSkeleton
        columns={2}
        rows={2}
        columnClassNames={[undefined, "text-right tabular-nums"]}
      />,
    );
    const bars = (nth: number) => [
      ...container.querySelectorAll(`tr > :nth-child(${nth}) > div`),
    ];
    expect(bars(2).length).toBe(3);
    expect(bars(2).every((bar) => bar.classList.contains("ml-auto"))).toBe(
      true,
    );
    expect(bars(1).some((bar) => bar.classList.contains("ml-auto"))).toBe(
      false,
    );
  });
});
