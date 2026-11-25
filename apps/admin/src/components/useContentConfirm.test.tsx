import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  contentFindings,
  linkDestinations,
  useContentConfirm,
} from "./useContentConfirm";

const worldallianceIn = (value: unknown) =>
  contentFindings({ value }).worldalliance;

describe("contentFindings worldalliance", () => {
  it("finds the text in nested strings, in any case", () => {
    expect(
      worldallianceIn({
        pages: [{ fields: [{ label: "See WorldAlliance.org" }] }],
        images: [{ src: "https://worldalliance.org/x.webp" }],
        count: 3,
        empty: null,
      }),
    ).toEqual(["See WorldAlliance.org", "https://worldalliance.org/x.webp"]);
  });

  it("marks where an excerpt cuts the text off", () => {
    const text = `${"a".repeat(40)} worldalliance ${"b".repeat(40)}`;

    expect(worldallianceIn(text)).toEqual([
      `…${"a".repeat(19)} worldalliance ${"b".repeat(19)}…`,
    ]);
  });

  it("keeps each excerpt on one line", () => {
    expect(
      worldallianceIn("Line one\n\nVisit worldalliance.org\nnext"),
    ).toEqual(["Line one Visit worldalliance.org next"]);
  });

  it("drops half an emoji where an excerpt cuts one in two", () => {
    expect(worldallianceIn(`${"😀".repeat(11)} worldalliance`)).toEqual([
      `…${"😀".repeat(9)} worldalliance`,
    ]);
    expect(worldallianceIn(`worldalliance ${"😀".repeat(11)}`)).toEqual([
      `worldalliance ${"😀".repeat(9)}…`,
    ]);
  });

  it("lists a repeated excerpt once", () => {
    expect(
      worldallianceIn([
        "https://worldalliance.org",
        "https://worldalliance.org",
      ]),
    ).toEqual(["https://worldalliance.org"]);
  });

  it("finds nothing in text without it", () => {
    expect(worldallianceIn({ body: "thealliance.org", n: 1 })).toEqual([]);
  });
});

describe("contentFindings site links", () => {
  const siteLinks = (text: unknown) =>
    contentFindings({ value: text, siteLinksIn: text });

  it("finds absolute links to the site on either domain", () => {
    expect(
      siteLinks(
        "[Act](https://thealliance.org/actions/53) and https://www.staging.worldalliance.org/feed.",
      ),
    ).toEqual({
      siteLinks: [
        "[Act](https://thealliance.org/actions/53) and https://www.st…",
        "…org/actions/53) and https://www.staging.worldalliance.org/feed.",
      ],
      worldalliance: [],
    });
  });

  it.each([
    "[Act](/actions/53)",
    "https://admin.thealliance.org/actions/53",
    "https://example.org/thealliance.org",
    "![Hero](https://thealliance.org/assets/hero.jpeg)",
    "![Hero](<https://thealliance.org/assets/hero.jpeg>)",
    "![Hero](https://thealliance.org/hero)",
    "![a [nested] caption](https://thealliance.org/hero)",
    "![Hero][hero]\n\n[hero]: https://thealliance.org/hero",
    '<img src="https://thealliance.org/apple-touch-icon.png">',
    '<img srcset="https://thealliance.org/a.png 1x, https://thealliance.org/b.png 2x">',
    "<a href='https://thealliance.org/actions/53'>Act</a>",
    '<a href = "https://thealliance.org/faq">FAQ</a>',
    "mailto:contact@thealliance.org",
    "[File](ftp://thealliance.org/a)",
    "https://%zz/thealliance.org",
    "[Act][act]\n\n[act]: https://example.org\n[act]: https://thealliance.org/a",
    "![Flyer][a]\n\n[Download][a]\n\n[a]: https://thealliance.org/flyer.png",
  ])("leaves %p alone", (text) => {
    expect(siteLinks(text).siteLinks).toEqual([]);
  });

  it.each([
    ["[Flyer](https://thealliance.org/api/images/1770255651460.webp)"],
    ["[Photo](https://thealliance.org/photo.png)"],
    ["Link = https://thealliance.org/actions/53"],
    ["<https://thealliance.org/actions/53>"],
    ["www.thealliance.org/actions/53"],
    ["[Act](//thealliance.org/actions/53)"],
    ["[Act][act]\n\n[act]: https://thealliance.org/actions/53"],
    [
      "[Act][act]\n\n[act]: https://thealliance.org/a\n[act]: https://example.org",
    ],
  ])("flags %p", (text) => {
    expect(siteLinks(text).siteLinks).toHaveLength(1);
  });

  it("still flags worldalliance outside a site link in the same text", () => {
    expect(
      siteLinks("https://worldalliance.org/a by worldalliance staff"),
    ).toEqual({
      siteLinks: ["https://worldalliance.org/a by worldalliance st…"],
      worldalliance: ["…ldalliance.org/a by worldalliance staff"],
    });
  });

  it("lists worldalliance in a site link's text and only the url as the link", () => {
    expect(
      siteLinks(
        "[Visit worldalliance, the movement for a better world](https://thealliance.org/x)",
      ),
    ).toEqual({
      siteLinks: ["…for a better world](https://thealliance.org/x)"],
      worldalliance: ["[Visit worldalliance, the movement for a…"],
    });
  });

  it.each([
    ["[worldalliance](https://thealliance.org/a&amp;b)", "inline link"],
    [
      "[worldalliance][x]\n\n[x]: https://thealliance.org/a&amp;b",
      "definition",
    ],
  ])(
    "lists worldalliance in a link's text when its url has an entity (%p)",
    (text) => {
      expect(siteLinks(text).worldalliance).toHaveLength(1);
    },
  );

  it.each([
    [
      '[Act](https://thealliance.org/a&amp;b "by worldalliance")',
      "inline link",
    ],
    [
      '[Act][x]\n\n[x]: https://thealliance.org/a&amp;b "by worldalliance"',
      "definition",
    ],
  ])(
    "lists worldalliance in a link's title when its url has an entity (%p)",
    (text) => {
      expect(siteLinks(text).worldalliance).toHaveLength(1);
    },
  );

  it("takes the url from the destination, not a title repeating it", () => {
    expect(
      siteLinks(
        '[Act](https://worldalliance.org/a "https://worldalliance.org/a")',
      ).worldalliance,
    ).toEqual(['…ance.org/a "https://worldalliance.org/a")']);
  });

  it.each([
    ["[Act]( https://worldalliance.org/a&amp;b)"],
    ["[Act](\n  https://worldalliance.org/a&amp;b)"],
  ])(
    "spans the whole url after whitespace that opens the destination (%p)",
    (text) => {
      const found = siteLinks(text);
      expect(found.worldalliance).toEqual([]);
      expect(found.siteLinks[0]).toContain("https://worldalliance.org/a&amp;b");
    },
  );

  it.each([
    [
      '[Act](https://worldalliance.org/a&amp;b "https://worldalliance.org/a&b")',
    ],
    [
      '[Act][x]\n\n[x]: https://worldalliance.org/a&amp;b "https://worldalliance.org/a&b"',
    ],
  ])(
    "takes an escaped url from the destination, not a title repeating it (%p)",
    (text) => {
      const found = siteLinks(text);
      expect(found.siteLinks[0]).toContain("worldalliance.org/a&amp;b");
      expect(found.worldalliance).toEqual([
        expect.stringContaining('"https://worldalliance.org/a&b"'),
      ]);
    },
  );

  it("spans an angle-bracket destination holding spaces", () => {
    expect(
      siteLinks("[Act](<https://worldalliance.org/a&amp;b worldalliance>)")
        .worldalliance,
    ).toEqual([]);
  });

  it("flags a whole url to the site, protocol-relative included, and lists worldalliance in it only as a link", () => {
    expect(
      contentFindings({
        value: [
          "//thealliance.org/team",
          "https://worldalliance.org/join",
          "https://thealliance.org/join",
        ],
        siteUrlsIn: [
          "//thealliance.org/team",
          "https://worldalliance.org/join",
          "https://thealliance.org/join",
          "https://thealliance.org/join",
          "/actions/53",
          "https://example.com/thealliance.org",
          "Go to https://thealliance.org/x",
        ],
      }),
    ).toEqual({
      siteLinks: [
        "//thealliance.org/team",
        "https://worldalliance.org/join",
        "https://thealliance.org/join",
      ],
      worldalliance: [],
    });
  });

  it("flags only markdown link syntax in siteLinksInCommonMark", () => {
    const commonMark = (text: string) =>
      contentFindings({ value: text, siteLinksInCommonMark: text }).siteLinks;

    expect(commonMark("See https://thealliance.org/a")).toEqual([]);
    expect(commonMark("See www.thealliance.org/a")).toEqual([]);
    expect(commonMark("[A](https://thealliance.org/a)")).toHaveLength(1);
    expect(commonMark("<https://thealliance.org/a>")).toHaveLength(1);
  });

  it("lists each link's destination, bare urls only where GFM links them", () => {
    const text = ["[A](/a 'title')", "See https://thealliance.org/b"];
    expect(linkDestinations(text, { bareUrls: true })).toEqual([
      "/a",
      "https://thealliance.org/b",
    ]);
    expect(linkDestinations(text, { bareUrls: false })).toEqual(["/a"]);
  });

  it("checks site links only in the text it is given", () => {
    expect(
      contentFindings({
        value: { title: "https://worldalliance.org/a", body: "x" },
        siteLinksIn: "x",
      }),
    ).toEqual({
      siteLinks: [],
      worldalliance: ["https://worldalliance.org/a"],
    });
  });
});

describe("useContentConfirm", () => {
  let confirmSave: ReturnType<typeof useContentConfirm>["confirmSave"];
  const Harness = () => {
    const confirm = useContentConfirm();
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

  it("lists site links and worldalliance mentions in their own sections", async () => {
    render(<Harness />);

    const body = "See https://thealliance.org/faq";
    act(() => {
      void confirmSave(
        { body, footer: "github.com/worldalliance" },
        { siteLinksIn: body },
      );
    });

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Save anyway?");
    expect(dialog.textContent).toContain(
      "Links to the site should be paths, such as /actions/53, so they keep working if the domain changes:\n• See https://thealliance.org/faq",
    );
    expect(dialog.textContent).toContain(
      "This mentions worldalliance. Links should use thealliance.org; names that still use worldalliance, such as the GitHub organization, can stay:\n• github.com/worldalliance",
    );
  });
});
