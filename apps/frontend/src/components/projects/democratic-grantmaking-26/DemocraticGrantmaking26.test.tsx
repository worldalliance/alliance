import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../../lib/AuthContext";
import { InviteSessionProvider } from "../../../site/invite/InviteSession";
import { authValue } from "../../../testing/authValue";
import DemocraticGrantmaking26, {
  WaitlistHeroImages,
} from "./DemocraticGrantmaking26";
import { ExpertGrid } from "./ExpertGrid";
import { FEATURED_PEOPLE } from "./placeholders";

let membersReply: () => Response;
let waitlistReply: () => Response;

serveApi(
  routes({
    "POST /user/nmembers": () => membersReply(),
    "GET /waitlist/count": () => waitlistReply(),
    "GET /waitlist/mail-config": () => Response.json({ enabled: false }),
    "GET /waitlist/browser": () => Response.json({ entry: null }),
  }),
);

beforeEach(() => {
  membersReply = () => Response.json({ count: 213 });
  waitlistReply = () => Response.json({ waiting: 309 });
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={authValue()}>
        <MemoryRouter>
          <InviteSessionProvider>
            <DemocraticGrantmaking26 />
          </InviteSessionProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

test("opens with a waitlist screen above the rest of the page", async () => {
  renderPage();

  const intro = screen.getByRole("region", { name: "Waitlist" });
  expect(intro.className).toContain("min-h-svh");
  const title = within(intro).getByRole("heading", { level: 1 });
  expect(title.textContent).toContain("Vote on where we donate $100,000");
  expect(
    within(intro).getByText("Fall 2026").compareDocumentPosition(title) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
  expect(
    within(intro).getByText(
      "Join the Alliance to participate in this grantmaking project.",
    ),
  ).toBeTruthy();
  expect(
    within(intro).getByRole("button", { name: "Join the Alliance waitlist" }),
  ).toBeTruthy();
  const stack = intro.querySelector("ul");
  expect(stack?.className).toContain("aspect-square");
  expect(stack?.className).toContain("flex-col");
  const strips = stack?.querySelectorAll(":scope > li") ?? [];
  expect(strips).toHaveLength(4);
  for (const strip of strips) expect(strip.querySelector("img")).toBeTruthy();

  const bar = await screen.findByRole("img", {
    name: "213 members and 309 on the waitlist, toward 1,000",
  });
  expect(
    intro.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
});

test("shows a set hero image in its strip", () => {
  render(
    <WaitlistHeroImages
      images={[
        { src: "/hero-1.jpg", alt: "First scene" },
        { src: null, alt: "" },
        { src: null, alt: "" },
        { src: null, alt: "" },
      ]}
    />,
  );

  const stack = screen.getByRole("list", { name: "Project images" });
  expect(stack.className).toContain("aspect-square");
  expect(stack.querySelectorAll(":scope > li")).toHaveLength(4);
  const photo = screen.getByRole("img", { name: "First scene" });
  expect(photo.getAttribute("src")).toBe("/hero-1.jpg");
  expect(photo.className).toContain("object-cover");
});

test("shows each expert once in an eight-column grid after the waitlist bar and the timeline", async () => {
  renderPage();

  const bar = await screen.findByRole("img", {
    name: "213 members and 309 on the waitlist, toward 1,000",
  });
  const line = screen.getByText(
    "Experts will comment on candidate nonprofits to help you make an informed vote.",
  );
  const grid = screen.getByRole("list", { name: "Expert panel" });
  const timeline = screen.getByRole("region", { name: "Timeline" });
  expect(
    bar.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
  expect(
    timeline.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
  expect(
    line.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
  expect(timeline.contains(grid)).toBe(false);
  expect(grid.classList.contains("grid-cols-4")).toBe(true);
  expect(grid.className).toContain("lg:grid-cols-8");
  const cards = [...grid.querySelectorAll(":scope > li")];
  expect(cards).toHaveLength(16);
  expect(screen.getByText("Nir Eyal")).toBeTruthy();
  expect(
    screen.getByText("Professor of Bioethics, UCL and Rutgers"),
  ).toBeTruthy();
  expect(screen.queryByText("To be announced")).toBeNull();
  expect(screen.getByText("Julia Paxton")).toBeTruthy();
  expect(
    screen.getByText("Professor of Economics, Ohio University"),
  ).toBeTruthy();
  expect(screen.getByText("Andrea Vernon")).toBeTruthy();
  expect(
    screen.getByText(
      "Executive Director of Experiential Learning and Clinical Professor, University of Montana",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Danielle McDonald")).toBeTruthy();
  expect(
    screen.getByText(
      "Professor of Criminal Justice, Northern Kentucky University",
    ),
  ).toBeTruthy();
  FEATURED_PEOPLE.forEach((person, index) => {
    const card = cards[index];
    expect(card?.textContent).toContain(person.name);
    expect(card?.textContent).toContain(person.role);
    const face = card?.querySelector("img");
    expect(face?.getAttribute("src")).toBe(person.imageSrc);
    expect(face?.className).toContain("aspect-square");
  });
});

test("only experts with profile URLs have links and link styling", () => {
  render(<ExpertGrid />);

  for (const person of FEATURED_PEOPLE) {
    const name = screen.getByText(person.name);
    const link = name.closest("a");
    if (person.href) {
      expect(link?.getAttribute("href")).toBe(person.href);
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noreferrer");
      expect(name.className).toContain("group-hover:");
    } else {
      expect(link).toBeNull();
      expect(name.className).not.toContain("underline");
      expect(name.closest("[target], [role=link], [tabindex]")).toBeNull();
    }
  }
});

test("marks preparation as the current phase", () => {
  renderPage();

  const current = screen
    .getByRole("region", { name: "Timeline" })
    .querySelector('[aria-current="step"]');
  expect(current?.textContent).toContain("Preparation");
});

test("stacks members and waitlist against the member goal", async () => {
  renderPage();

  const bar = await screen.findByRole("img", {
    name: "213 members and 309 on the waitlist, toward 1,000",
  });
  const [members, waitlist] = Array.from(
    bar.querySelectorAll<HTMLElement>(":scope > div"),
    (segment) => segment.style.width,
  );
  expect(members).toBe("21.3%");
  expect(waitlist).toBe("30.9%");
});

test.each<[string, () => void]>([
  ["member", () => (membersReply = () => new Response(null, { status: 500 }))],
  [
    "waitlist",
    () => (waitlistReply = () => new Response(null, { status: 500 })),
  ],
])(
  "says the counts are unavailable when the %s count fails",
  async (_count, fail) => {
    fail();
    renderPage();

    await screen.findByText(
      "Member and waitlist counts unavailable",
      {},
      { timeout: 2500 },
    );
  },
);
