import type { WaitlistBrowserDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { InviteSessionProvider } from "../../../site/invite/InviteSession";
import { WaitlistSignupForm } from "./WaitlistSignupForm";

let posted: number;

serveApi(
  routes({
    "GET /waitlist/mail-config": () => Response.json({ enabled: false }),
    "GET /waitlist/browser": () => Response.json({ entry: null }),
    "POST /waitlist/entries": () => {
      posted += 1;
      return Response.json({ shareCode: "abc123" });
    },
  }),
);

beforeEach(() => {
  posted = 0;
});

test("a closed form greys out with its message and sends nothing", async () => {
  const client = new QueryClient();
  client.setQueryData(queryKeys.waitlistBrowser(), {
    entry: null,
  } satisfies WaitlistBrowserDto);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/projects/safer-chatbots-for-children"]}>
        <InviteSessionProvider>
          <WaitlistSignupForm submitLabel="Join" closedMessage="Not live yet" />
        </InviteSessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Test Person" },
  });
  fireEvent.change(screen.getByLabelText("Email or mobile number"), {
    target: { value: "person@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Join" }));

  const button = screen.getByRole<HTMLButtonElement>("button", {
    name: "Not live yet",
  });
  expect(button.disabled).toBe(true);
  fireEvent.submit(button.closest("form")!);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(posted).toBe(0);
});
