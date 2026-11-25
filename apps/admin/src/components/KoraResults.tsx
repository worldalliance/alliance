import type { KoraQuestionCountsDto } from "@alliance/shared/client";
import { downloadBlob } from "@alliance/sharedweb/lib/downloadBlob";
import { format } from "date-fns";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  useDownloadKoraExports,
  useDownloadKoraSpecExport,
  useKoraAnswersAdmin,
} from "../lib/useKoraResultsAdmin";
import Button, { ButtonColor } from "../ui/Button";
import { useToast } from "../ui/ToastProvider";

function AnswerTable({
  caption,
  questions,
}: {
  caption: string;
  questions: KoraQuestionCountsDto[];
}) {
  if (questions.length === 0) return null;
  return (
    <table className="text-sm">
      <caption className="text-left font-medium">{caption}</caption>
      <thead className="text-left text-zinc-500">
        <tr>
          <th className="px-3 py-1">Question</th>
          <th className="px-3 py-1">Answers</th>
        </tr>
      </thead>
      <tbody>
        {questions.map(({ question, answers }) => (
          <tr key={question} className="border-t border-zinc-200 align-top">
            <td className="px-3 py-1 font-mono">{question}</td>
            <td className="px-3 py-1">
              {answers.map((a) => `${a.value}: ${a.count}`).join(", ")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function KoraResults() {
  const answers = useKoraAnswersAdmin();
  const toast = useToast();
  const download = useDownloadKoraExports({
    onReady: (jsonl) =>
      downloadBlob(
        new Blob([jsonl], { type: "application/x-ndjson" }),
        `kora-reviews-${format(new Date(), "yyyy-MM-dd")}.jsonl`,
      ),
    onError: (err) => {
      toast.error(adminRefusalMessage(err, "Couldn't download. Try again."));
      console.error(err);
    },
  });

  const koraFile = useDownloadKoraSpecExport({
    onReady: (json) =>
      downloadBlob(
        new Blob([json], { type: "application/json" }),
        `kora-export-${format(new Date(), "yyyy-MM-dd")}.json`,
      ),
    onError: (err) => {
      toast.error(adminRefusalMessage(err, "Couldn't download. Try again."));
      console.error(err);
    },
  });

  return (
    <section aria-labelledby="kora-results" className="space-y-3 text-sm">
      <h2 id="kora-results" className="font-semibold">
        Results for KORA
      </h2>
      <Button
        color={ButtonColor.Black}
        size="small"
        disabled={download.isPending}
        onClick={() => download.mutate()}
      >
        {download.isPending ? "Preparing…" : "Download reviews (.jsonl)"}
      </Button>{" "}
      <Button
        color={ButtonColor.Black}
        size="small"
        disabled={koraFile.isPending}
        onClick={() => koraFile.mutate("rolling")}
      >
        {koraFile.isPending ? "Preparing…" : "Download KORA export (.json)"}
      </Button>
      <p className="text-zinc-600">
        The KORA export holds ratings, highlights, sessions, skips and reviewers
        in KORA&apos;s format. Demographics, consent and end-of-session feedback
        are empty until the tool collects them.
      </p>
      {answers.isPending && <p>Loading answers…</p>}
      {answers.isError && (
        <p className="text-red-600" role="alert">
          {adminRefusalMessage(
            answers.error,
            "Couldn't load the answers. Reload to try again.",
          )}
        </p>
      )}
      {answers.data && (
        <>
          <p className="text-zinc-600">
            {answers.data.profiles} reviewers answered the profile and{" "}
            {answers.data.exitSurveys} answered the exit survey. Counts only: no
            individual answers are shown.
          </p>
          <AnswerTable caption="Profile" questions={answers.data.profile} />
          <AnswerTable
            caption="Exit survey"
            questions={answers.data.exitSurvey}
          />
        </>
      )}
    </section>
  );
}
