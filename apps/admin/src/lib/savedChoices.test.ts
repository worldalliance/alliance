import type { FormResponseDto } from "@alliance/shared/client";
import { savedChoicesAcrossResponses } from "./savedChoices";

const response = (
  createdAt: string,
  formulaChoices: FormResponseDto["formulaChoices"],
): FormResponseDto => ({
  id: 1,
  formId: 1,
  formSnapshotId: 7,
  answers: {},
  publicAnswers: {},
  createdAt,
  schemaSnapshot: {},
  phDistinctId: null,
  deviceType: null,
  sessionReplayUrl: null,
  sid: null,
  visibilityValidatorResults: {},
  formulaChoices,
});

it("merges every response's saved choices under the label first saved", () => {
  expect(
    savedChoicesAcrossResponses([
      response("2026-03-05T00:00:00.000Z", {
        pick: [
          { label: "Renamed", value: "a" },
          { label: "Beta", value: "b" },
        ],
      }),
      response("2026-03-04T00:00:00.000Z", {
        pick: [{ label: "Alpha", value: "a" }],
        other: [{ label: "Gamma", value: "c" }],
      }),
    ]),
  ).toEqual({
    pick: [
      { label: "Alpha", value: "a" },
      { label: "Beta", value: "b" },
    ],
    other: [{ label: "Gamma", value: "c" }],
  });
});
