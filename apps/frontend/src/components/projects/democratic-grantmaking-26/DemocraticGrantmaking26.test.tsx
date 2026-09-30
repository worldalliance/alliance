import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../../lib/AuthContext";
import { authValue } from "../../../testing/authValue";
import DemocraticGrantmaking26 from "./DemocraticGrantmaking26";

let membersReply: () => Response;
let waitlistReply: () => Response;

serveApi(
  routes({
    "POST /user/nmembers": () => membersReply(),
    "GET /waitlist/count": () => waitlistReply(),
    "GET /waitlist/mail-config": () => Response.json({ enabled: false }),
  }),
);

beforeEach(() => {
  membersReply = () => Response.json({ count: 213 });
  waitlistReply = () => Response.json({ waiting: 309 });
});

afterEach(cleanup);

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={authValue()}>
        <MemoryRouter>
          <DemocraticGrantmaking26 />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

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
