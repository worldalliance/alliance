import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useRememberInvite } from "./useRememberInvite";

let remembered: unknown[];

serveApi(
  routes({
    "POST /waitlist/browser/invite": async ({ request }) => {
      remembered.push(await request.json());
      return new Response(null, { status: 204 });
    },
  }),
);

beforeEach(() => {
  remembered = [];
});

afterEach(cleanup);

function RememberInvite({ code }: { code: string | null }) {
  useRememberInvite(code);
  return null;
}

test("remembers an opened invite code, and nothing without one", async () => {
  const client = new QueryClient();
  client.setQueryData(queryKeys.waitlistBrowser(), {
    entry: null,
    inviteCode: null,
  });
  const withClient = (code: string | null) => (
    <QueryClientProvider client={client}>
      <RememberInvite code={code} />
    </QueryClientProvider>
  );
  const { rerender } = render(withClient(null));
  rerender(withClient("invite1"));

  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.waitlistBrowser())?.isInvalidated,
    ).toBe(true),
  );
  expect(remembered).toEqual([{ code: "invite1" }]);
});
