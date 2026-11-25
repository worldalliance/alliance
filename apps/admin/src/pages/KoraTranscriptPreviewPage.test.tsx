import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import sample from "../../../../kora-review/samples/transcript.json";
import KoraTranscriptPreviewPage from "./KoraTranscriptPreviewPage";

let fetched = 0;

serveApi(
  routes({
    "GET /kora/admin/batches/:id/random-transcript": () => {
      fetched++;
      return Response.json({
        transcript: sample,
        contentHash: `sha256:${"0".repeat(64)}`,
      });
    },
  }),
);

test("mounts the review tool with a random transcript and says nothing is saved", async () => {
  const { container } = render(
    <MemoryRouter initialEntries={["/kora-participants/preview/b1"]}>
      <Routes>
        <Route
          path="/kora-participants/preview/:batchId"
          element={<KoraTranscriptPreviewPage />}
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
