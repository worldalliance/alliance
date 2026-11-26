import { describe, expect, it } from "bun:test";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import plugin, { classProblem, utilityOf } from "./design-rules.mjs";

describe("utilityOf", () => {
  it("drops variants, bracketed ones included", () => {
    expect(utilityOf("p-2")).toBe("p-2");
    expect(utilityOf("hover:not-disabled:bg-surface-2")).toBe("bg-surface-2");
    expect(utilityOf("aria-[current=true]:bg-accent-soft")).toBe(
      "bg-accent-soft",
    );
    expect(utilityOf("[&:nth-child(2)]:p-[13px]")).toBe("p-[13px]");
  });
});

describe("classProblem", () => {
  it.each([
    "bg-gray-100",
    "text-red-600",
    "hover:bg-zinc-800",
    "border-b-slate-200",
    "bg-white",
    "text-black/50",
    "bg-green",
    "text-gray-3",
    "ring-blue-500!",
    "from-emerald-50",
    "text-shadow-black",
  ])("calls %s a raw colour", (className) => {
    expect(classProblem(className)).toBe("rawColor");
  });

  it.each([
    "p-[13px]",
    "text-[#333]",
    "md:w-[calc(100%-2rem)]",
    "grid-cols-[1fr_20rem]",
    "-mt-[3px]",
    "bg-(--brand)",
    "w-(length:--x)",
    "[mask-type:luminance]",
    "text-sm/[17px]",
    "bg-surface/[0.3]",
    "bg-surface/(--alpha)",
    "max-[600px]:hidden",
    "md:min-[900px]:flex",
  ])("calls %s an arbitrary value", (className) => {
    expect(classProblem(className)).toBe("arbitraryValue");
  });

  it.each([
    "bg-surface",
    "text-fg-muted",
    "border-line-strong",
    "bg-accent-soft",
    "text-danger",
    "bg-cat-3-soft",
    "border-transparent",
    "text-body",
    "h-control-sm",
    "max-w-120",
    "data-[state=open]:bg-surface-2",
    "aria-[current=true]:text-fg",
    "group-data-bleed/table:first:pl-page",
    "bg-accent/50",
    "max-md:hidden",
    "text-right",
    "border-b-2",
    "shadow-pop",
    "to-do",
    "input[name=x]",
    "Type [brackets] in prose",
  ])("lets %s through", (className) => {
    expect(classProblem(className)).toBeNull();
  });
});

describe("admin/design-tokens", () => {
  const lint = (code: string) =>
    new Linter()
      .verify(
        code,
        {
          files: ["**/*.tsx"],
          languageOptions: {
            parser: tseslint.parser,
            parserOptions: { ecmaFeatures: { jsx: true } },
          },
          plugins: { admin: plugin },
          rules: { "admin/design-tokens": "error" },
        },
        "Page.tsx",
      )
      .map((message) => message.message.split("`")[1]);

  it("reports each offending class in attributes, calls and templates", () => {
    expect(
      lint(
        'const a = <div className="flex bg-gray-100 p-[13px]" />;\n' +
          'const b = cn("text-fg", on && "text-red-600");\n' +
          "const c = `w-[40px] ${x} bg-surface`;",
      ),
    ).toEqual(["bg-gray-100", "p-[13px]", "text-red-600", "w-[40px]"]);
  });

  it("reports a value a template builds", () => {
    expect(lint("const a = `flex w-[${w}px] text-sm/[${h}px]`;")).toEqual([
      "w-[…]",
      "text-sm/[…]",
    ]);
    expect(lint("const a = `Row [${index}] of ${count}`;")).toEqual([]);
  });

  it("passes token classes", () => {
    expect(
      lint('const a = <div className="rounded-card bg-surface px-page" />;'),
    ).toEqual([]);
  });
});

describe("admin/design-values", () => {
  const lint = (code: string) =>
    new Linter()
      .verify(
        code,
        {
          files: ["**/*.tsx"],
          languageOptions: {
            parser: tseslint.parser,
            parserOptions: { ecmaFeatures: { jsx: true } },
          },
          plugins: { admin: plugin },
          rules: { "admin/design-values": "error" },
        },
        "Chart.tsx",
      )
      .map((message) => message.messageId);

  it("reports raw colours in fill, stroke and style", () => {
    expect(
      lint(
        'const a = <rect fill="#e5e7eb" stroke={"rgba(0,0,0,0.1)"} />;\n' +
          'const b = <circle fill="white" />;\n' +
          "const c = <div style={{ background: `color-mix(in oklab, ${x} 14%, transparent)` }} />;\n" +
          'const d = <span style={{ color: "oklch(0.5 0.1 20)" }} />;',
      ),
    ).toEqual([
      "rawColorValue",
      "rawColorValue",
      "rawColorValue",
      "rawColorValue",
      "rawColorValue",
    ]);
  });

  it("reports a fixed length in style, not one computed from data", () => {
    expect(
      lint(
        "const a = <div style={{ gridTemplateColumns: `12rem repeat(${n}, 2.75rem)` }} />;\n" +
          "const b = <div style={{ width: `${share}%`, left: x, minWidth: width }} />;",
      ),
    ).toEqual(["fixedLength"]);
  });

  it("passes token values, patterns and none", () => {
    expect(
      lint(
        'const a = <rect fill="var(--color-line)" stroke={chartColor.grid} />;\n' +
          "const b = <rect fill={`url(#${id})`} />;\n" +
          'const c = <path fill="none" stroke="currentColor" />;',
      ),
    ).toEqual([]);
  });
});

describe("admin/page-height", () => {
  const lint = (code: string) =>
    new Linter()
      .verify(
        code,
        {
          files: ["**/*.tsx"],
          languageOptions: {
            parser: tseslint.parser,
            parserOptions: { ecmaFeatures: { jsx: true } },
          },
          plugins: { admin: plugin },
          rules: { "admin/page-height": "error" },
        },
        "Page.tsx",
      )
      .map((message) => message.message.split("`")[1]);

  it.each(["h-screen", "min-h-screen", "md:h-dvh", "max-h-svh"])(
    "reports %s anywhere",
    (className) => {
      expect(
        lint(`const a = <main><div className="${className}" /></main>;`),
      ).toEqual([className]);
    },
  );

  it("reports h-full on a returned root, not on a nested element", () => {
    expect(
      lint(
        'const A = () => <div className="flex h-full"><i className="h-full" /></div>;\n' +
          'function B() { return <div className="h-full" />; }',
      ),
    ).toEqual(["h-full", "h-full"]);
  });
});
