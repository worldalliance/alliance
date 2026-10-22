import type { AnyField } from "@alliance/common/forms/form-schema";
import type {
  ActionWithdrawalDto,
  FormResponseDto,
} from "@alliance/shared/client";
import { makeFormResponse, makeUser } from "@alliance/shared/lib/testFixtures";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import QuestionResponses from "./QuestionResponses";

const essay: AnyField = {
  id: "essay",
  type: "input",
  kind: "textarea",
  label: "Essay",
};

const color: AnyField = {
  id: "color",
  type: "input",
  kind: "radio",
  label: "Color",
  options: [{ label: "Bright red", value: "red" }],
};

const detection = (aiProbability: number | null) => ({
  id: 1,
  fieldPath: "answers.essay",
  status: "completed" as const,
  aiProbability,
  modelVersion: null,
  createdAt: "2026-03-05T10:00:00.000Z",
  updatedAt: "2026-03-05T10:00:00.000Z",
});

const renderQuestions = (params: {
  responses: FormResponseDto[];
  loading?: boolean;
  error?: string | null;
  orderedFieldIds?: string[];
  selectedQuestionFieldId?: string;
  onSelectQuestionField?: (fieldId: string) => void;
  withdrawnUserMap?: Map<number, ActionWithdrawalDto>;
}) =>
  render(
    <QuestionResponses
      loading={params.loading ?? false}
      error={params.error ?? null}
      responses={params.responses}
      orderedFieldIds={params.orderedFieldIds ?? ["essay", "color"]}
      fieldLabels={
        new Map([
          ["essay", "Essay"],
          ["color", "Color"],
        ])
      }
      fieldsById={
        new Map<string, AnyField>([
          ["essay", essay],
          ["color", color],
        ])
      }
      selectedQuestionFieldId={params.selectedQuestionFieldId ?? "essay"}
      onSelectQuestionField={params.onSelectQuestionField ?? (() => {})}
      getResponseVariantName={() => "Short"}
      getRespondentName={(response) => `Respondent ${response.id}`}
      withdrawnUserMap={params.withdrawnUserMap ?? new Map()}
    />,
  );

it("lists each answer to the question with its respondent and AI score", () => {
  renderQuestions({
    responses: [
      makeFormResponse({
        id: 1,
        answers: { essay: "My essay" },
        aiDetectionResults: [detection(0.42)],
      }),
      makeFormResponse({ id: 2, answers: { essay: "" } }),
      makeFormResponse({
        id: 3,
        answers: { essay: "Unscored" },
        aiDetectionResults: [detection(null)],
      }),
    ],
  });

  expect(screen.getByText("AI Score")).toBeTruthy();
  expect(screen.getByText("Respondent 1")).toBeTruthy();
  expect(screen.getByText("My essay")).toBeTruthy();
  expect(screen.getByText("42%")).toBeTruthy();
  expect(screen.getByText("--")).toBeTruthy();
  expect(screen.queryByText("Respondent 2")).toBeNull();
  expect(screen.getAllByText("Short")).toHaveLength(2);
});

it("shows a choice answer by its option label, without an AI score", () => {
  renderQuestions({
    responses: [makeFormResponse({ id: 1, answers: { color: "red" } })],
    selectedQuestionFieldId: "color",
  });

  expect(screen.getByText("Bright red")).toBeTruthy();
  expect(screen.queryByText("AI Score")).toBeNull();
});

it("marks a respondent who withdrew", () => {
  renderQuestions({
    responses: [
      makeFormResponse({
        id: 1,
        user: makeUser({ id: 9 }),
        answers: { essay: "Mine" },
      }),
    ],
    withdrawnUserMap: new Map([
      [9, { userId: 9, declineReason: null, isMoral: null, outOfTime: true }],
    ]),
  });

  expect(screen.getByText("Withdrew")).toBeTruthy();
});

it("reports the question picked", () => {
  const onSelectQuestionField = jest.fn();
  renderQuestions({ responses: [], onSelectQuestionField });
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "color" },
  });

  expect(onSelectQuestionField).toHaveBeenCalledWith("color");
});

it("shows the load state, or that the form has no questions, instead of answers", () => {
  renderQuestions({ responses: [], loading: true });
  expect(screen.getByText("Loading responses...")).toBeTruthy();
  cleanup();

  renderQuestions({ responses: [], error: "Failed to load" });
  expect(screen.getByText("Failed to load")).toBeTruthy();
  cleanup();

  renderQuestions({ responses: [], orderedFieldIds: [] });
  expect(screen.getByText("No answerable questions found.")).toBeTruthy();
});
