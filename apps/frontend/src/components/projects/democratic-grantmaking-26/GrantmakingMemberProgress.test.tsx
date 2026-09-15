import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { GrantmakingMemberProgress } from "./GrantmakingMemberProgress";

let reply: () => Response;

serveApi(routes({ "POST /user/nmembers": () => reply() }));

afterEach(cleanup);

const renderProgress = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GrantmakingMemberProgress />
    </QueryClientProvider>,
  );

test("shows the live count against the goal", async () => {
  reply = () => Response.json({ count: 250 });
  renderProgress();

  await screen.findByText("250 / 1,000 members");
  screen.getByText("This project will run when we reach 1,000 members.");
  const bar = screen.getByRole("progressbar");
  expect(bar.getAttribute("aria-valuenow")).toBe("250");
  expect(bar.querySelector("div")?.style.width).toBe("25%");
});

test("caps the bar at the goal but keeps the full count", async () => {
  reply = () => Response.json({ count: 1500 });
  renderProgress();

  await screen.findByText("1,500 / 1,000 members");
  const bar = screen.getByRole("progressbar");
  expect(bar.getAttribute("aria-valuenow")).toBe("1000");
  expect(bar.querySelector("div")?.style.width).toBe("100%");
});

test("says the count is unavailable when the server errors", async () => {
  reply = () => new Response(null, { status: 500 });
  renderProgress();

  await screen.findByText("Member count unavailable", {}, { timeout: 2500 });
  expect(screen.queryByText(/\/ 1,000 members/)).toBeNull();
});
