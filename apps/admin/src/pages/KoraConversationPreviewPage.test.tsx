import { SAMPLE_ITEMS } from "@alliance/kora-review/sample-export";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import KoraConversationPreviewPage from "./KoraConversationPreviewPage";

let fetched: number;
let status: number;

serveApi(
  routes({
    "GET /kora/admin/batches/:id/random-conversation": () => {
      fetched++;
      return status === 200
        ? Response.json({ item: SAMPLE_ITEMS[1] })
        : Response.json({ message: "nope" }, { status });
    },
  }),
);

beforeEach(() => {
  fetched = 0;
  status = 200;
});

test("mounts the review tool with a random conversation and says nothing is saved", async () => {
  const { container } = render(
    <MemoryRouter initialEntries={["/kora-participants/preview/b1"]}>
      <Routes>
        <Route
          path="/kora-participants/preview/:batchId"
          element={<KoraConversationPreviewPage />}
        />
      </Routes>
    </MemoryRouter>,
    queryWrapper(),
  );

  await screen.findByText(
    "Preview: this is what reviewers see. Nothing you do here is saved.",
  );
  await waitFor(() =>
    expect(container.querySelector(".kr-app")).not.toBeNull(),
  );
  expect(fetched).toBe(1);
});

test("fetches another conversation on request", async () => {
  render(
    <MemoryRouter initialEntries={["/kora-participants/preview/b1"]}>
      <Routes>
        <Route
          path="/kora-participants/preview/:batchId"
          element={<KoraConversationPreviewPage />}
        />
      </Routes>
    </MemoryRouter>,
    queryWrapper(),
  );

  const again = await screen.findByRole("button", {
    name: "Show another conversation",
  });
  fireEvent.click(again);
  await waitFor(() => expect(fetched).toBe(2));
});

test("says when no conversation can be loaded", async () => {
  status = 500;
  render(
    <MemoryRouter initialEntries={["/kora-participants/preview/b1"]}>
      <Routes>
        <Route
          path="/kora-participants/preview/:batchId"
          element={<KoraConversationPreviewPage />}
        />
      </Routes>
    </MemoryRouter>,
    queryWrapper(),
  );

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(
    "Couldn't load a conversation. Reload to try again.",
  );
});
