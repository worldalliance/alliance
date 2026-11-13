import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  useWorldallianceConfirm,
  worldallianceExcerpts,
} from "./useWorldallianceConfirm";

describe("worldallianceExcerpts", () => {
  it("finds the text in nested strings, in any case", () => {
    expect(
      worldallianceExcerpts({
        pages: [{ fields: [{ label: "See WorldAlliance.org" }] }],
        images: [{ src: "https://worldalliance.org/x.webp" }],
        count: 3,
        empty: null,
      }),
    ).toEqual(["See WorldAlliance.org", "https://worldalliance.org/x.webp"]);
  });

  it("marks where an excerpt cuts the text off", () => {
    const text = `${"a".repeat(40)} worldalliance ${"b".repeat(40)}`;

    expect(worldallianceExcerpts(text)).toEqual([
      `…${"a".repeat(19)} worldalliance ${"b".repeat(19)}…`,
    ]);
  });

  it("keeps each excerpt on one line", () => {
    expect(
      worldallianceExcerpts("Line one\n\nVisit worldalliance.org\nnext"),
    ).toEqual(["Line one Visit worldalliance.org next"]);
  });

  it("drops half an emoji where an excerpt cuts one in two", () => {
    expect(worldallianceExcerpts(`${"😀".repeat(11)} worldalliance`)).toEqual([
      `…${"😀".repeat(9)} worldalliance`,
    ]);
    expect(worldallianceExcerpts(`worldalliance ${"😀".repeat(11)}`)).toEqual([
      `worldalliance ${"😀".repeat(9)}…`,
    ]);
  });

  it("lists a repeated excerpt once", () => {
    expect(
      worldallianceExcerpts([
        "https://worldalliance.org",
        "https://worldalliance.org",
      ]),
    ).toEqual(["https://worldalliance.org"]);
  });

  it("finds nothing in text without it", () => {
    expect(worldallianceExcerpts({ body: "thealliance.org", n: 1 })).toEqual(
      [],
    );
  });
});

describe("useWorldallianceConfirm", () => {
  let confirmSave: (value: unknown) => Promise<boolean>;
  const Harness = () => {
    const confirm = useWorldallianceConfirm();
    confirmSave = confirm.confirmSave;
    return confirm.dialog;
  };

  it("confirms text without worldalliance without asking", async () => {
    render(<Harness />);

    await expect(confirmSave("https://thealliance.org")).resolves.toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each([
    ["Save anyway", true],
    ["Cancel", false],
  ])("resolves %s as %s once the dialog is answered", async (button, saved) => {
    render(<Harness />);

    let answer!: Promise<boolean>;
    act(() => {
      answer = confirmSave({
        body: "[Settings](https://worldalliance.org/settings)",
      });
    });
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "• [Settings](https://worldalliance.org/settings)",
    );
    fireEvent.click(screen.getByRole("button", { name: button }));

    await expect(answer).resolves.toBe(saved);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("resolves an earlier call false when a second one replaces it", async () => {
    render(<Harness />);

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = confirmSave("https://worldalliance.org/a");
    });
    act(() => {
      second = confirmSave("https://worldalliance.org/b");
    });
    await expect(first).resolves.toBe(false);
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "https://worldalliance.org/b",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save anyway" }));

    await expect(second).resolves.toBe(true);
  });
});
