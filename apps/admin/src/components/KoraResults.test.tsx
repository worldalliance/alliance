import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { render, screen, within } from "@testing-library/react";
import { exportsJsonl } from "../lib/useKoraResultsAdmin";
import { KoraResults } from "./KoraResults";

serveApi(
  routes({
    "GET /kora/admin/results/answers": () =>
      Response.json({
        sessions: 2,
        feedback: [
          {
            question: "f1",
            answers: [
              { value: "fully", count: 1 },
              { value: "mostly", count: 1 },
            ],
          },
          { question: "f6", answers: [{ value: "about_right", count: 1 }] },
        ],
      }),
  }),
);

test("shows answer counts, never individual answers", async () => {
  render(
    <ToastProvider>
      <KoraResults />
    </ToastProvider>,
    queryWrapper(),
  );

  await screen.findByText(/2 sessions ended with their feedback answered/);
  const feedback = screen.getByRole("table", {
    name: "End-of-session feedback",
  });
  expect(within(feedback).getByText("fully: 1, mostly: 1")).toBeTruthy();
  expect(within(feedback).getByText("about_right: 1")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Download reviews (.jsonl)" }),
  ).toBeTruthy();
});

test("writes one export per line", () => {
  expect(exportsJsonl([{ a: 1 }, { b: 2 }])).toBe('{"a":1}\n{"b":2}\n');
  expect(exportsJsonl([])).toBe("");
});
