import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen, within } from "@testing-library/react";
import { ConversationsPanel } from "./ConversationsPanel";

serveApi(
  routes({
    "GET /kora/admin/conversations": () =>
      Response.json({
        conversations: [
          {
            id: "conv-0042",
            category: "fear_trauma_and_distress",
            uploadedAt: "2026-11-20T10:00:00.000Z",
            reviewsPerTranscript: 5,
            reviews: 3,
            medianTimeMs: 150000,
            minTimeMs: 45000,
            maxTimeMs: 3725000,
          },
          {
            id: "conv-0043",
            category: "cybersecurity",
            uploadedAt: "2026-11-20T10:00:00.000Z",
            reviewsPerTranscript: 5,
            reviews: 0,
            medianTimeMs: null,
            minTimeMs: null,
            maxTimeMs: null,
          },
        ],
      }),
  }),
);

it("lists each conversation with its reviews against the target and its review times", async () => {
  render(<ConversationsPanel />, queryWrapper());
  const table = await screen.findByRole("table");
  const rows = within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );
  expect(rows.map((r) => [r[0], r[1], ...r.slice(3)])).toEqual([
    [
      "conv-0042",
      "Fear and distress",
      "3 of 5",
      "2 minutes 30 seconds",
      "45 seconds",
      "1 hour 2 minutes 5 seconds",
    ],
    ["conv-0043", "Cybersecurity", "0 of 5", "—", "—", "—"],
  ]);
});
