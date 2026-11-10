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
        profiles: 2,
        profile: [
          {
            question: "is_parent",
            answers: [
              { value: "yes", count: 1 },
              { value: "no", count: 1 },
            ],
          },
        ],
        exitSurveys: 1,
        exitSurvey: [
          { question: "exit_q1", answers: [{ value: "very", count: 1 }] },
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

  await screen.findByText(/2 reviewers answered the profile and 1 answered/);
  const profile = screen.getByRole("table", { name: "Profile" });
  expect(within(profile).getByText("yes: 1, no: 1")).toBeTruthy();
  const exit = screen.getByRole("table", { name: "Exit survey" });
  expect(within(exit).getByText("very: 1")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Download reviews (.jsonl)" }),
  ).toBeTruthy();
});

test("writes one export per line", () => {
  expect(exportsJsonl([{ a: 1 }, { b: 2 }])).toBe('{"a":1}\n{"b":2}\n');
  expect(exportsJsonl([])).toBe("");
});
