import type { KoraQuestionCountsDto } from "@alliance/shared/client";
import { downloadBlob } from "@alliance/sharedweb/lib/downloadBlob";
import { format } from "date-fns";
import { useId, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf, formatCount } from "../../lib/formatNumber";
import {
  useDownloadKoraExports,
  useDownloadKoraSpecExport,
  useKoraAnswersAdmin,
} from "../../lib/useKoraResultsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import InlineError from "../../ui/InlineError";
import { Skeleton } from "../../ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel, PanelNote } from "../../ui/templates/Overview";
import { ContentState } from "../../ui/templates/States";

function AnswerTable({
  caption,
  questions,
}: {
  caption: string;
  questions: KoraQuestionCountsDto[];
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-heading font-semibold">
        {caption}
      </h3>
      {questions.length === 0 ? (
        <PanelNote>No answers yet.</PanelNote>
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <Table aria-labelledby={id}>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Answers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map(({ question, answers }) => (
                <TableRow key={question}>
                  <TableCell className="font-mono text-xs">
                    {question}
                  </TableCell>
                  <TableCell>
                    {answers
                      .map((a) => `${a.value}: ${formatCount(a.count)}`)
                      .join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

const today = () => format(new Date(), "yyyy-MM-dd");

export function ResultsPanel() {
  const answers = useKoraAnswersAdmin();
  const [problem, setProblem] = useState<string | null>(null);
  const fail = (err: Error) =>
    setProblem(adminRefusalMessage(err, "Couldn't download the file."));
  const reviews = useDownloadKoraExports({
    onReady: (jsonl) =>
      downloadBlob(
        new Blob([jsonl], { type: "application/x-ndjson" }),
        `kora-reviews-${today()}.jsonl`,
      ),
    onError: fail,
  });
  const koraFile = useDownloadKoraSpecExport({
    onReady: (json) =>
      downloadBlob(
        new Blob([json], { type: "application/json" }),
        `kora-export-${today()}.json`,
      ),
    onError: fail,
  });

  return (
    <Panel title="Results for KORA">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={ButtonVariant.Default}
              busy={reviews.isPending}
              onClick={() => {
                setProblem(null);
                reviews.mutate();
              }}
            >
              Download reviews (.jsonl)
            </Button>
            <Button
              variant={ButtonVariant.Default}
              busy={koraFile.isPending}
              onClick={() => {
                setProblem(null);
                koraFile.mutate("rolling");
              }}
            >
              Download KORA export (.json)
            </Button>
            <InlineError message={problem} />
          </div>
          {/* kora-spec-export.ts leaves these null until the tool collects them. */}
          <p className="max-w-prose text-fg-muted">
            The KORA export holds ratings, highlights, sessions, skips and
            reviewers in KORA's format. Demographics, consent and end-of-session
            feedback are empty until the tool collects them.
          </p>
        </div>
        <ContentState
          things="the answers"
          query={answers}
          skeleton={
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-96 max-w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          }
        >
          {answers.data && (
            <div className="flex flex-col gap-5">
              <p>
                {countOf(answers.data.profiles, "reviewer")} answered the
                profile and {formatCount(answers.data.exitSurveys)} answered the
                exit survey. Counts only: no individual answers are shown.
              </p>
              <AnswerTable caption="Profile" questions={answers.data.profile} />
              <AnswerTable
                caption="Exit survey"
                questions={answers.data.exitSurvey}
              />
            </div>
          )}
        </ContentState>
      </div>
    </Panel>
  );
}
