import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { act, screen, waitFor } from "@testing-library/react";
import {
  api,
  pressAndConfirm,
  renderPage,
  serveGroupPageApi,
} from "./groupPageTesting";

serveGroupPageApi();

it("says why loading the member details was refused", async () => {
  api.memberInfoStatus = 403;
  renderPage({ tab: "progress" });

  expect(await screen.findByText("Members only")).toBeTruthy();
});

it("says why loading the members' contact info was refused", async () => {
  api.contactInfoStatus = 403;
  renderPage({ tab: "progress" });

  expect(await screen.findByText(/Contact info is private/)).toBeTruthy();
});

it("loads the member details and users alongside the group", async () => {
  api.listHeld = new Promise((resolve) => {
    api.releaseList = resolve;
  });
  renderPage();

  await waitFor(() => expect(api.memberInfoRequests).toBe(1));
  await waitFor(() => expect(api.userListRequests).toBe(1));
});

it("reloads the member details after a membership change", async () => {
  renderPage();
  await screen.findByRole("button", { name: "Remove from group: Sam" });
  await waitFor(() => expect(api.memberInfoRequests).toBe(1));

  await pressAndConfirm("Remove from group: Sam", "Remove from group");

  await waitFor(() => expect(api.memberInfoRequests).toBe(2));
});

it("says when the members' contact info fails to refresh", async () => {
  const client = renderPage({ tab: "progress" });
  await screen.findByRole("heading", { level: 1, name: "North" });
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.communityMemberContactInfoAdmin(4))
        ?.status,
    ).toBe("success"),
  );
  api.contactInfoStatus = 403;
  await act(() =>
    client.refetchQueries({
      queryKey: queryKeys.communityMemberContactInfoAdmin(4),
    }),
  );

  expect(
    await screen.findByText(
      /Couldn't refresh the members' contact details\. Contact info is private/,
    ),
  ).toBeTruthy();
});

it("says nothing of the contact details' refresh while progress has failed", async () => {
  api.memberInfoStatus = 500;
  const client = renderPage({ tab: "progress" });
  await screen.findByText("Couldn't load progress");
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.communityMemberContactInfoAdmin(4))
        ?.status,
    ).toBe("success"),
  );
  api.contactInfoStatus = 403;
  await act(() =>
    client.refetchQueries({
      queryKey: queryKeys.communityMemberContactInfoAdmin(4),
    }),
  );

  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.communityMemberContactInfoAdmin(4))
        ?.status,
    ).toBe("error"),
  );
  expect(
    screen.queryByText(/Couldn't refresh the members' contact/),
  ).toBeNull();
});
