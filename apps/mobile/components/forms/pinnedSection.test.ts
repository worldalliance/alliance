import { pinnedSection } from "./pinnedSection";

const first = { top: 100, bottom: 500 };
const second = { top: 600, bottom: 900 };
const pinned = (scrollY: number) =>
  pinnedSection({ sections: [first, second], scrollY, barHeight: 44 });

describe("pinnedSection", () => {
  test("pins nothing until the member scrolls past a section's top", () => {
    expect(pinned(50)).toBeNull();
    expect(pinned(100)).toBeNull();
  });

  test("pins the section the member has scrolled into", () => {
    expect(pinned(101)).toBe(first);
    expect(pinned(700)).toBe(second);
  });

  test("unpins before the bar would cover the next section's title", () => {
    expect(pinned(455)).toBe(first);
    expect(pinned(456)).toBeNull();
  });
});
