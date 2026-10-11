import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import PlantBasedStudyResults from "./PlantBasedStudyResults";

const CHART_IDS = [
  "chart-hero",
  "chart-gap",
  "chart-who",
  "chart-dumbbell",
  "chart-plan",
];

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`no #${id}`);
  return el;
}

function svgIn(chartId: string): SVGSVGElement {
  const svg = byId(chartId).querySelector("svg");
  if (!svg) throw new Error(`no svg in #${chartId}`);
  return svg;
}

function whoDots(): SVGElement[] {
  return Array.from(
    svgIn("chart-who").querySelectorAll<SVGElement>("circle.person"),
  );
}

function dotPoint(dot: SVGElement): { clientX: number; clientY: number } {
  const [, x, y] =
    /translate\(([\d.]+)px,\s*([\d.]+)px\)/.exec(dot.style.transform) ?? [];
  return { clientX: Number(x), clientY: Number(y) };
}

function whoRowLabels(): string[] {
  return Array.from(
    svgIn("chart-who").querySelectorAll('text[x="4"][font-weight="650"]'),
  ).map((t) => t.textContent ?? "");
}

function heroCursor(): Element {
  const cursor = svgIn("chart-hero").querySelector("g[opacity]");
  if (!cursor) throw new Error("no hero cursor");
  return cursor;
}

function dumbbellOrder(): string[] {
  const rowY = (g: Element) =>
    Number(
      /translate\(0px,\s*([\d.]+)px\)/.exec(g.getAttribute("style") ?? "")?.[1],
    );
  return Array.from(byId("chart-dumbbell").querySelectorAll("g.drow"))
    .sort((a, b) => rowY(a) - rowY(b))
    .map((g) => g.querySelector("text")?.textContent ?? "");
}

beforeEach(() => {
  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 920, height: 445 }));
});

afterEach(cleanup);

describe("PlantBasedStudyResults", () => {
  it("draws each chart once, even when effects run twice", () => {
    render(
      <StrictMode>
        <PlantBasedStudyResults />
      </StrictMode>,
    );

    for (const id of CHART_IDS) {
      expect(byId(id).querySelectorAll("svg")).toHaveLength(1);
    }
  });

  it("steps the hero chart's days from the keyboard and clears on Escape", () => {
    render(<PlantBasedStudyResults />);

    fireEvent.keyDown(byId("chart-hero"), { key: "ArrowRight" });

    expect(byId("ir-live").textContent).toBe(
      "Day 1. Reduction average 23.2 grams (19.8 to 26.9), 217 logs. Comparison 29.5 grams (23.6 to 35.6), 53 logs.",
    );
    expect(byId("ir-tip").style.display).toBe("block");

    fireEvent.keyDown(byId("chart-hero"), { key: "End" });

    expect(byId("ir-live").textContent).toMatch(/^Day 14\./);

    fireEvent.keyDown(byId("chart-hero"), { key: "ArrowLeft" });

    expect(byId("ir-live").textContent).toMatch(/^Day 13\./);

    fireEvent.keyDown(byId("chart-hero"), { key: "Home" });

    expect(byId("ir-live").textContent).toMatch(/^Day 1\./);

    fireEvent.keyDown(byId("chart-hero"), { key: "Escape" });

    expect(byId("ir-tip").style.display).toBe("none");

    fireEvent.keyDown(byId("chart-hero"), { key: "ArrowLeft" });

    expect(byId("ir-live").textContent).toMatch(/^Day 14\./);
  });

  it("follows the pointer across the hero chart's days and clears on leave", () => {
    render(<PlantBasedStudyResults />);

    fireEvent.pointerMove(svgIn("chart-hero"), { clientX: 95, clientY: 200 });

    expect(byId("ir-live").textContent).toMatch(/^Day 1\./);
    expect(byId("ir-tip").textContent).toMatch(/^Day 1 · average logged day/);
    expect(heroCursor().getAttribute("opacity")).toBe("1");

    fireEvent.pointerMove(svgIn("chart-hero"), { clientX: 875, clientY: 200 });

    expect(byId("ir-live").textContent).toMatch(/^Day 14\./);

    fireEvent.pointerLeave(svgIn("chart-hero"));

    expect(byId("ir-tip").style.display).toBe("none");
    expect(heroCursor().getAttribute("opacity")).toBe("0");
  });

  it("clears the hero chart's tooltip when it loses focus", () => {
    render(<PlantBasedStudyResults />);
    fireEvent.keyDown(byId("chart-hero"), { key: "ArrowRight" });

    fireEvent.blur(byId("chart-hero"));

    expect(byId("ir-tip").style.display).toBe("none");
  });

  it("shows a bar's count when hovering the surprise chart", () => {
    render(<PlantBasedStudyResults />);

    fireEvent.pointerMove(svgIn("chart-gap"), { clientX: 150, clientY: 250 });

    expect(byId("ir-tip").textContent).toBe(
      "much easier6 people · 3% of the group",
    );

    fireEvent.pointerMove(svgIn("chart-gap"), { clientX: 5, clientY: 250 });

    expect(byId("ir-tip").style.display).toBe("none");

    fireEvent.pointerMove(svgIn("chart-gap"), { clientX: 150, clientY: 250 });
    fireEvent.pointerLeave(svgIn("chart-gap"));

    expect(byId("ir-tip").style.display).toBe("none");
  });

  it("regroups the dot plot when another split is picked", () => {
    render(<PlantBasedStudyResults />);

    expect(byId("ir-live").textContent).toMatch(
      /^Now showing expected difficulty\./,
    );

    expect(whoRowLabels()).toEqual([
      "Easy (1–2)",
      "Moderate (3)",
      "Hard (4–5)",
    ]);
    const before = new Map(whoDots().map((d) => [d, d.style.transform]));

    const gender = screen.getByRole("radio", { name: "Gender" });
    fireEvent.click(gender);

    expect(whoRowLabels()).toEqual(["Women", "Men"]);
    expect(
      whoDots().some(
        (d) => d.style.opacity === "1" && d.style.transform !== before.get(d),
      ),
    ).toBe(true);

    expect(byId("ir-live").textContent).toMatch(
      /^Now showing gender\. Women: typical \d+ percent of normal\. Men: typical \d+ percent of normal\.$/,
    );
    expect(gender.getAttribute("aria-checked")).toBe("true");
    expect(
      screen
        .getByRole("radio", { name: "Expected difficulty" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("shows a person's share when hovering a shown dot, and nothing elsewhere", () => {
    render(<PlantBasedStudyResults />);
    const dot = whoDots().find((c) => c.style.opacity === "1");
    if (!dot) throw new Error("no shown dot");

    fireEvent.pointerMove(svgIn("chart-who"), dotPoint(dot));

    expect(byId("ir-tip").textContent).toMatch(
      /^One person · (Easy \(1–2\)|Moderate \(3\)|Hard \(4–5\))ate \d+% of their normal amount$/,
    );

    fireEvent.pointerMove(svgIn("chart-who"), { clientX: 5, clientY: 5 });

    expect(byId("ir-tip").style.display).toBe("none");

    fireEvent.pointerMove(svgIn("chart-who"), dotPoint(dot));
    fireEvent.pointerLeave(svgIn("chart-who"));

    expect(byId("ir-tip").style.display).toBe("none");
  });

  it("ignores dots the current split hides when hovering", () => {
    render(<PlantBasedStudyResults />);
    fireEvent.click(screen.getByRole("radio", { name: "Gender" }));
    const hidden = whoDots().filter((c) => c.style.opacity === "0");
    expect(hidden.length).toBeGreaterThan(0);

    for (const dot of hidden) {
      fireEvent.pointerMove(svgIn("chart-who"), dotPoint(dot));

      expect(byId("ir-tip").textContent).not.toMatch(/Easy|Moderate|Hard/);
    }
  });

  it("reorders the dumbbell rows when another sort is picked", () => {
    render(<PlantBasedStudyResults />);

    expect(dumbbellOrder().slice(0, 2)).toEqual([
      "Cravings & taste",
      "Eating out & social",
    ]);

    fireEvent.click(screen.getByRole("radio", { name: "Most expected" }));

    expect(dumbbellOrder().slice(0, 2)).toEqual([
      "Cravings & taste",
      "Protein and nutrition",
    ]);
  });

  it("highlights a dumbbell row and shows its shares while hovered", () => {
    render(<PlantBasedStudyResults />);
    const hit = byId("chart-dumbbell").querySelector("g.drow rect");
    if (!hit) throw new Error("no dumbbell row");

    fireEvent.pointerMove(hit, { clientX: 300, clientY: 50 });

    expect(byId("ir-tip").textContent).toBe(
      "Cravings & tasteexpected by 27% → experienced by 44%",
    );
    expect(hit.getAttribute("fill")).toBe("var(--chip-bg)");

    fireEvent.pointerLeave(svgIn("chart-dumbbell"));

    expect(byId("ir-tip").style.display).toBe("none");
    expect(hit.getAttribute("fill")).toBe("transparent");
  });

  it("shows a segment's share while hovering the plan bar", () => {
    render(<PlantBasedStudyResults />);

    fireEvent.pointerMove(svgIn("chart-plan"), { clientX: 70, clientY: 130 });

    expect(byId("ir-tip").textContent).toBe("Yes, definitely146 of 281 · 52%");

    fireEvent.pointerMove(svgIn("chart-plan"), { clientX: 5, clientY: 130 });

    expect(byId("ir-tip").style.display).toBe("none");

    fireEvent.pointerMove(svgIn("chart-plan"), { clientX: 70, clientY: 130 });
    fireEvent.pointerLeave(svgIn("chart-plan"));

    expect(byId("ir-tip").style.display).toBe("none");
  });
});
